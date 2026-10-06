/**
 * Pergunta da portaria (Caddy on-demand TLS) antes de emitir um certificado:
 * `GET /api/pages/edge/allow?domain=<host>` → 200 se o domínio está verificado, 404 se não.
 * Sem isso qualquer pessoa apontaria um domínio para a portaria e gastaria a cota de certificados.
 */
import { toValidCustomDomain } from "@/features/pages/lib/edge-headers";
import { isCustomDomainVerified } from "@/features/pages/server/custom-domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const customDomain = toValidCustomDomain(new URL(request.url).searchParams.get("domain"));
  if (!customDomain) return new Response(null, { status: 404 });

  const isVerified = await isCustomDomainVerified(customDomain).catch(() => false);
  return new Response(null, { status: isVerified ? 200 : 404 });
}
