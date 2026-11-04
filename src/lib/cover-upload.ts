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

const READ_ERROR = "Não conseguimos ler essa foto. Tente outra imagem.";

async function loadImage(file: File): Promise<{ src: CanvasImageSource; w: number; h: number; done: () => void }> {
  try {
    const bmp = await createImageBitmap(file);
    return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close?.() };
  } catch {
    // Safari antigo / HEIC: cai para <img>
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error(READ_ERROR));
      img.src = url;
    });
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  }
}

export async function resizeToJpegBlob(file: File, maxWidth = 800, quality = 0.85): Promise<Blob> {
  const img = await loadImage(file).catch(() => {
    throw new Error(READ_ERROR);
  });
  if (!img.w || !img.h) throw new Error(READ_ERROR);
  const scale = Math.min(1, maxWidth / img.w);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.w * scale));
  canvas.height = Math.max(1, Math.round(img.h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(READ_ERROR);
  ctx.drawImage(img.src, 0, 0, canvas.width, canvas.height);
  img.done();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", quality));
  if (!blob || blob.size === 0) throw new Error(READ_ERROR);
  return blob;
}

/** Redimensiona no navegador e envia um JPEG para o bucket "capas". */
export async function uploadCover(file: File, userId: string): Promise<string> {
  if (file.type && !file.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem");
  if (file.size > MAX_BYTES * 4) throw new Error("Imagem muito grande");
  if (file.size === 0) throw new Error(READ_ERROR);

  const blob = await resizeToJpegBlob(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from("capas")
    .upload(path, blob, { cacheControl: "3600", upsert: false, contentType: "image/jpeg" });

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
