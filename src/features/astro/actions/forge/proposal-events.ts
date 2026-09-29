import "server-only";
import { pusherServer } from "@/lib/pusher";

/**
 * Avisa as telas do Forge que as propostas mudaram (spec 0032, RF-11 e D-5).
 * Best-effort e sempre fora de transação (Regra 18): falha de aviso não pode
 * derrubar a escrita que já aconteceu.
 */

export const FORGE_PROPOSALS_CHANGED_EVENT = "forge:proposals-changed";

export async function notifyForgeProposalsChanged(organizationId: string): Promise<void> {
  try {
    await pusherServer.trigger(`private-org-${organizationId}`, FORGE_PROPOSALS_CHANGED_EVENT, {});
  } catch (error) {
    console.warn("[astro/forge] proposals_changed_broadcast_failed", error);
  }
}
