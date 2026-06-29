/**
 * Helper de upload de imagem compartilhado por todos os uploaders do
 * NASA Pages (LogoUploader, HeroImageUploader, ImageProps, ImageUploaderField).
 *
 * Fluxo único: `POST /api/s3/upload-direct` → server faz PUT no R2 via
 * SDK (server-to-server, sem CORS) e devolve `{ key }`. Montamos URL
 * pública via `NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL`.
 *
 * Mesmo padrão usado pelo fallback do Uploader global e por outros
 * features (actions, tracking-chat). Sem fallback local — em prod o
 * volume não justifica o filesystem em `public/uploads/`, que de toda
 * forma não persiste no Vercel.
 */

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/s3/upload-direct", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error ?? `Upload falhou (HTTP ${response.status})`);
  }

  const { key } = (await response.json()) as { key: string };
  const bucketHost = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
  if (!bucketHost) {
    throw new Error(
      "NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL não configurada — não consigo montar URL pública.",
    );
  }
  return `https://${bucketHost}/${key}`;
}
