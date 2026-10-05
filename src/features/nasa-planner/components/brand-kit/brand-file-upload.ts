"use client";

/**
 * Envio de arquivo do Kit da Marca. Produção: R2 por URL assinada (devolve a chave).
 * Desenvolvimento: se o R2 recusar (CORS/chave sem escrita), cai no /api/upload-local — imagem devolve /uploads/...,
 * vídeo devolve a URL completa (os players do Planner só aceitam chave do R2 ou http).
 */
export async function uploadBrandFile(file: File): Promise<string> {
  const isImage = file.type.startsWith("image/");
  try {
    const presignResponse = await fetch("/api/s3/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, isImage }),
    });
    if (!presignResponse.ok) throw new Error("presign");
    const { presignedUrl, key } = (await presignResponse.json()) as { presignedUrl: string; key: string };
    const putResponse = await fetch(presignedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!putResponse.ok) throw new Error("put");
    return key;
  } catch (uploadError) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Não deu para enviar o arquivo. Tente de novo.", { cause: uploadError });
    }
    const formData = new FormData();
    formData.append("file", file);
    const localResponse = await fetch("/api/upload-local", { method: "POST", body: formData });
    if (!localResponse.ok) throw new Error("Não deu para enviar o arquivo.");
    const { url } = (await localResponse.json()) as { url: string };
    return isImage ? url : `${window.location.origin}${url}`;
  }
}

const S3_PUBLIC_BASE = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL ? `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}` : "";

/** Chave do R2, URL externa ou /uploads local → URL para exibir. */
export function brandFileUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("http") || value.startsWith("/") || value.startsWith("data:")) return value;
  return `${S3_PUBLIC_BASE}/${value}`;
}
