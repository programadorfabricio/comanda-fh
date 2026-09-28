import type { SupabaseClient } from "@supabase/supabase-js";

export const urlFoto = (caminho: string | null | undefined) =>
  caminho ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/produtos/${caminho}` : null;

// Diminui a foto no celular antes de enviar (fica leve para o tablet carregar rápido)
async function reduzir(arquivo: File, lado = 900): Promise<Blob> {
  const img = await createImageBitmap(arquivo);
  const escala = Math.min(1, lado / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Não consegui ler a foto."))), "image/jpeg", 0.82));
}

export async function enviarFoto(supabase: SupabaseClient, empresaId: string, produtoId: string, arquivo: File) {
  const blob = await reduzir(arquivo);
  const caminho = `${empresaId}/${produtoId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("produtos").upload(caminho, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error("Não foi possível enviar a foto.");
  return caminho;
}

export async function apagarFoto(supabase: SupabaseClient, caminho: string | null | undefined) {
  if (caminho) await supabase.storage.from("produtos").remove([caminho]);
}
