/**
 * Constrói o URL completo a partir de uma key armazenada (S3/R2).
 * Robusta contra env var ausente: nunca retorna `https://undefined/...`
 * (que era a causa do bug "imagem não aparece em produção" quando
 * `NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL` estava vazio).
 */
export function useConstructUrl(key: string): string {
  if (!key) return "";

  // Já é URL completa? devolve direto
  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }
  if (key.startsWith("/") || key.startsWith("data:")) {
    return key;
  }

  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
  if (!bucket || bucket === "undefined") {
    if (typeof window !== "undefined") {
      // Warning útil pro dev (uma única vez por sessão pra não floodar)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (!w.__nasaS3WarnShown) {
        w.__nasaS3WarnShown = true;
        // eslint-disable-next-line no-console
        console.warn(
          "[useConstructUrl] NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL não configurado — imagens armazenadas como keys não vão resolver.",
        );
      }
    }
    return `/uploads/${key.replace(/^\/+/, "")}`;
  }

  const host = bucket.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const cleanKey = key.replace(/^\/+/, "");
  return `https://${host}/${cleanKey}`;
}
