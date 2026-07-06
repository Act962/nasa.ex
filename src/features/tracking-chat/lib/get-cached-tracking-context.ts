import "server-only";
import prisma from "@/lib/prisma";
import type { WhatsAppProvider } from "@/generated/prisma/enums";

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
  /**
   * Provider WhatsApp da instância 1:1 deste tracking (`null` se não há
   * instância). Usado pelo webhook Uazapi pra gatear inbound: se o tracking
   * está em `META_CLOUD`, o POST Uazapi é ignorado (#9 — evita mensagens
   * duplicadas quando o webhook Uazapi externo segue ativo após a migração).
   */
  whatsappProvider: WhatsAppProvider | null;
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
      whatsappProvider: cached.whatsappProvider,
    };
  }

  const row = await prisma.tracking.findUnique({
    where: { id: trackingId },
    select: {
      id: true,
      organizationId: true,
      globalAiActive: true,
      whatsappInstance: { select: { provider: true } },
    },
  });
  if (!row) return null;

  const fresh: CachedTrackingContext = {
    id: row.id,
    organizationId: row.organizationId,
    globalAiActive: row.globalAiActive,
    whatsappProvider: row.whatsappInstance?.provider ?? null,
  };

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
