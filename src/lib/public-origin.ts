// Endereço público do app, para URL que sai do servidor (retorno do Stripe, webhook, link em
// mensagem). Atrás do proxy de produção a origem da requisição é a interna do container
// (0.0.0.0:3000): `req.nextUrl.origin` nunca serve para isso.
// A env vem antes dos headers porque é o único jeito de apontar para um túnel em localhost.
export function resolvePublicOrigin(headers?: Headers): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const host =
    headers?.get("x-forwarded-host")?.split(",")[0]?.trim() || headers?.get("host");
  if (host) {
    const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const protocol =
      headers?.get("x-forwarded-proto")?.split(",")[0]?.trim() || (isLocalHost ? "http" : "https");
    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}
