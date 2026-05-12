/**
 * Resolve um valor armazenado como `coverImage` num URL válido pra
 * renderizar.
 *
 * Aceita 4 formatos:
 *  1. URL completa (`https://...`) → retorna como está.
 *  2. Path absoluto (`/uploads/x.png`) → retorna como está.
 *  3. S3 / R2 key (`actions/abc.png`) → prepende
 *     `https://${NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/`.
 *  4. Vazio/null → retorna `""` (componentes tratam como sem cover).
 *
 * Em produção, se a env var não estiver setada (causa comum do bug
 * "imagem some"), evitamos retornar `https://undefined/key` — que
 * geraria fetch quebrado + falha silenciosa do Next/Image.
 */
export function imgSrc(path: string | null | undefined): string {
  if (!path) return "";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (path.startsWith("/")) {
    return path;
  }
  if (path.startsWith("data:")) {
    return path;
  }

  const bucket =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL
      : undefined;

  if (bucket && bucket !== "undefined") {
    // Remove protocolo se vier por engano na env var
    const host = bucket.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const key  = path.replace(/^\/+/, "");
    return `https://${host}/${key}`;
  }

  // Sem bucket configurado → cai pra `/uploads/...` (funciona em dev).
  // Em prod sem env var setada, isso vai 404, mas no mínimo NÃO gera
  // `https://undefined/...` que polui o console.
  return `/uploads/${path.replace(/^\/+/, "")}`;
}
