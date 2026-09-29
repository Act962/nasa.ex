import "server-only";
import { eventBus } from "@/features/alerts/lib/event-bus";
import { handleCatalogStageEntry } from "./stage-flow";

type LeadStatusChangedPayload = { leadId: string; toStatusId: string; actorUserId?: string | null };

let isRegistered = false;

// Card entrou numa coluna de etapa do pedido (arrastar, detalhe, lote, pagamento, Astro) → spec 0044.
export function registerCatalogStageSubscriber(): void {
  if (isRegistered) return;
  isRegistered = true;
  eventBus.subscribe<LeadStatusChangedPayload>("lead.status_changed", async (payload) => {
    await handleCatalogStageEntry({ leadId: payload.leadId, statusId: payload.toStatusId, actorUserId: payload.actorUserId ?? null });
  });
}
