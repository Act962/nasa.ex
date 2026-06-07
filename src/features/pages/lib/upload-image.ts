/**
 * Helper de upload de imagem compartilhado por todos os uploaders do
 * NASA Pages (LogoUploader, HeroImageUploader, ImageProps, ImageUploaderField).
 *
 * Estratégia (em ordem):
 *   1. `/api/s3/upload-direct` — server-side PUT pro R2 (Cloudflare).
 *      Funciona em produção (Vercel) porque o arquivo é enviado server→R2,
 *      não browser→R2 (evita CORS). Retorna `{ key }`; montamos URL pública
 *      via `NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL`.
 *   2. `/api/upload-local` — fallback dev (Docker local). Grava em
 *      `public/uploads/` e retorna `/uploads/<uuid>.ext`. NÃO funciona em prod
 *      (filesystem read-only no Vercel — era a causa das imagens sumindo
 *      em https://orbita.nasaex.com).
 *
 * Quando R2 retorna 503 (env vars ausentes em dev), caímos pro local.
 * Em prod o local nem é tentado se R2 OK.
 */

/**
 * Tenta upload via R2 server-side. Retorna URL pública ou null em caso
 * de 503 (R2 não configurado) — caller decide fallback.
 */
async function tryUploadR2(file: File): Promise<string | null> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/s3/upload-direct", {
    method: "POST",
    body: form,
  });

  // 503 = R2 não configurado (dev sem env vars).
  if (response.status === 503) return null;

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error ?? `R2 upload HTTP ${response.status}`);
  }

  const { key } = (await response.json()) as { key: string };
  const bucketHost = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
  if (!bucketHost) {
    console.warn(
      "[upload-image] R2 upload OK mas NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL não setada",
    );
    return null;
  }
  return `https://${bucketHost}/${key}`;
}

/** Fallback dev — grava no `public/uploads/`. NÃO persiste em prod (Vercel). */
async function uploadLocal(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/upload-local", {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error ?? `Local upload HTTP ${response.status}`);
  }
  const { url } = (await response.json()) as { url: string };
  return url;
}

/**
 * Helper público — única função que TODOS os uploaders devem chamar.
 * Faz cascata R2 → local com avisos apropriados.
 */
export async function uploadImage(file: File): Promise<string> {
  let uploadedUrl: string | null = null;
  try {
    uploadedUrl = await tryUploadR2(file);
  } catch (r2Err) {
    console.warn("[upload-image] R2 falhou, tentando local:", r2Err);
  }

  if (!uploadedUrl) {
    uploadedUrl = await uploadLocal(file);
    // Em prod o local NÃO persiste — avisa o user que algo está errado.
    if (
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      console.error(
        "[upload-image] Caiu no fallback local em produção — R2 NÃO está configurado. Imagem NÃO vai persistir.",
      );
    }
  }

  return uploadedUrl;
}
