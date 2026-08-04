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

/**
 * Tenta enviar a capa para o bucket "capas" do Storage.
 * Se o bucket não existir/permitir, guarda uma versão comprimida embutida.
 */
export async function uploadCover(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem");
  if (file.size > MAX_BYTES) throw new Error("Imagem muito grande (máx. 5MB)");

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${crypto.randomUUID()}.${ext || "jpg"}`;

  const { error } = await supabase.storage
    .from("capas")
    .upload(path, file, { cacheControl: "3600", upsert: false });

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
