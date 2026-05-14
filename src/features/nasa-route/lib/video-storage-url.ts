/**
 * Constrói a URL pública pra um vídeo no bucket R2 NASA Route.
 *
 * O bucket é DIFERENTE do bucket principal do app (que usa
 * NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL via use-construct-url.ts). Aqui usamos
 * NEXT_PUBLIC_R2_NASA_ROUTE_PUBLIC_URL — custom domain ou *.r2.dev do bucket
 * `nasa-route-videos`.
 *
 * Em prod: custom domain (ex: videos.nasaagents.com) configurado no Cloudflare.
 * Em dev: pode ser *.r2.dev (público mas rate-limited — só pra teste).
 */
export function r2NasaRouteVideoUrl(fileKey: string): string {
  const host = process.env.NEXT_PUBLIC_R2_NASA_ROUTE_PUBLIC_URL;
  if (!host) {
    throw new Error(
      "NEXT_PUBLIC_R2_NASA_ROUTE_PUBLIC_URL não configurado — defina no .env.local",
    );
  }
  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const cleanKey = fileKey.replace(/^\//, "");
  return `https://${cleanHost}/${cleanKey}`;
}
