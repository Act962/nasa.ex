import "server-only";
import prisma from "@/lib/prisma";

/**
 * Cache in-process do contexto mínimo do Tracking usado pelos webhooks de chat
 * (`/api/chat/webhook`, `/api/in-chat/[slug]/messages` etc.). PK lookup com TTL
 * curto pra cortar roundtrip extra em hot path — especialmente após a
 * interceptação do Astro Bot, que precisa do `organizationId` antes de saber
 * se a mensagem é comando ou lead.
 *
 * Trade-off de staleness:
 *   - `organizationId` é efetivamente imutável (tracking não muda de org).
 *   - `globalAiActive` pode ser toggleado pelo admin — admin vê efeito em
 *     até TTL segundos. Janela aceitável pra o ganho de latência.
 *
 * Cache vive por processo (Node single-instance). Em dev com Turbopack o map
 * é recriado a cada hot-reload, então a staleness não atrapalha debug.
 */

const TTL_MS = 30_000;

interface CachedTrackingContext {
  id: string;
  organizationId: string;
  globalAiActive: boolean;
}

interface CacheEntry extends CachedTrackingContext {
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getCachedTrackingContext(
  trackingId: string,
): Promise<CachedTrackingContext | null> {
  const now = Date.now();
  const cached = cache.get(trackingId);
  if (cached && cached.expiresAt > now) {
    return {
      id: cached.id,
      organizationId: cached.organizationId,
      globalAiActive: cached.globalAiActive,
    };
  }

  const fresh = await prisma.tracking.findUnique({
    where: { id: trackingId },
    select: { id: true, organizationId: true, globalAiActive: true },
  });
  if (!fresh) return null;

  cache.set(trackingId, { ...fresh, expiresAt: now + TTL_MS });
  return fresh;
}

/**
 * Invalida explicitamente a entrada do cache — chamar quando o admin altera
 * `globalAiActive` ou o tracking é deletado, pra evitar esperar o TTL.
 */
export function invalidateTrackingContext(trackingId: string): void {
  cache.delete(trackingId);
}
