import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;

export async function compressToDataUrl(file: File, maxWidth = 500): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.8);
}

const READ_ERROR =
  "Não conseguimos ler essa imagem. Tente tirar um print da capa e enviar o print, ou use outra foto.";

type Loaded = { src: CanvasImageSource; w: number; h: number; done: () => void };

// Decodifica já reduzida (resizeWidth). Fotos grandes de celular decodificadas
// no tamanho original estouram a memória do canvas em alguns Android e saem
// pretas, sem erro nenhum.
async function loadAsBitmap(file: File, maxWidth: number): Promise<Loaded> {
  const opts = { resizeWidth: maxWidth, resizeQuality: "high", imageOrientation: "from-image" } as ImageBitmapOptions;
  const bmp = await createImageBitmap(file, opts);
  return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close?.() };
}

async function loadAsImg(file: File): Promise<Loaded> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((ok, fail) => {
    img.onload = () => ok();
    img.onerror = () => fail(new Error(READ_ERROR));
    img.src = url;
  });
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

// Canvas de uma cor só (todo preto, todo branco ou vazio) = a foto não foi
// desenhada. Uma capa de verdade sempre tem variação de cor.
function isBlank(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean {
  try {
    const w = canvas.width;
    const h = canvas.height;
    const pontos = 9;
    let min = 255;
    let max = 0;
    for (let i = 1; i <= pontos; i++) {
      for (let j = 1; j <= pontos; j++) {
        const x = Math.floor((w * i) / (pontos + 1));
        const y = Math.floor((h * j) / (pontos + 1));
        const [r = 0, g = 0, b = 0] = ctx.getImageData(x, y, 1, 1).data;
        const luz = Math.round((r + g + b) / 3);
        if (luz < min) min = luz;
        if (luz > max) max = luz;
        if (max - min > 12) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function drawToJpeg(img: Loaded, maxWidth: number, quality: number): Promise<Blob | null> {
  if (!img.w || !img.h) return null;
  const scale = Math.min(1, maxWidth / img.w);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.w * scale));
  canvas.height = Math.max(1, Math.round(img.h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff"; // PNG transparente não vira fundo preto
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img.src, 0, 0, canvas.width, canvas.height);
  img.done();
  if (isBlank(canvas, ctx)) return null;
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", quality));
  return blob && blob.size > 0 ? blob : null;
}

export async function resizeToJpegBlob(file: File, maxWidth = 800, quality = 0.85): Promise<Blob> {
  // 1ª tentativa: decodificar já reduzida. 2ª: pelo <img> do navegador.
  const tentativas: Array<() => Promise<Loaded>> = [() => loadAsBitmap(file, maxWidth), () => loadAsImg(file)];
  for (const carregar of tentativas) {
    try {
      const blob = await drawToJpeg(await carregar(), maxWidth, quality);
      if (blob) return blob;
    } catch {
      // tenta o próximo jeito
    }
  }
  throw new Error(READ_ERROR);
}

/** Redimensiona no navegador e envia um JPEG para o bucket "capas". */
export async function uploadCover(file: File, userId: string): Promise<string> {
  if (file.type && !file.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem");
  if (file.size > MAX_BYTES * 4) throw new Error("Imagem muito grande");
  if (file.size === 0) throw new Error(READ_ERROR);

  let corpo: Blob;
  let tipo = "image/jpeg";
  let extensao = "jpg";
  try {
    corpo = await resizeToJpegBlob(file);
  } catch (err) {
    // Se o navegador não conseguiu redimensionar, envia a foto original
    // quando ela for pequena e de um formato que todo navegador mostra.
    const formatosOk = ["image/jpeg", "image/png", "image/webp"];
    if (file.size <= MAX_BYTES && formatosOk.includes(file.type)) {
      corpo = file;
      tipo = file.type;
      extensao = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    } else {
      throw err;
    }
  }

  const path = `${userId}/${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage
    .from("capas")
    .upload(path, corpo, { cacheControl: "3600", upsert: false, contentType: tipo });

  if (error) {
    console.error("Falha ao enviar imagem para o Storage:", error);
    throw new Error("Não foi possível enviar a imagem. Tente novamente em alguns instantes.");
  }

  const { data } = supabase.storage.from("capas").getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Não foi possível gerar o link da imagem enviada.");
  }
  return data.publicUrl;
}
