import "server-only";
import prisma from "@/lib/prisma";
import type { LoyaltyRedemptionChannel } from "@/generated/prisma/enums";
import { deliverTextToLead } from "@/features/nerp-catalog/lib/order-channel";

export type RedemptionOutcome = "APPROVED" | "DELIVERED" | "REJECTED" | "CANCELED";

// Balcão resolve na frente do cliente e o Chat já leva a confirmação ao campo de mensagem do
// atendente: aviso automático só para quem pediu sozinho (portal e Astro).
const REMOTE_CHANNELS = new Set<LoyaltyRedemptionChannel>(["PORTAL", "ASTRO"]);

function buildMessage(outcome: RedemptionOutcome, rewardName: string, costStars: number, reason: string | null) {
  switch (outcome) {
    case "APPROVED":
      return `✅ Sua troca foi aprovada: ${rewardName} por ${costStars} stars. A loja vai separar o seu prêmio.`;
    case "DELIVERED":
      return `🎁 Prêmio entregue: ${rewardName}. Obrigado por ser STAR FRIEND!`;
    case "REJECTED":
      return `Sua troca por ${rewardName} não foi aprovada${reason ? `: ${reason}` : ""}. Suas stars continuam no saldo.`;
    case "CANCELED":
      return `Sua troca por ${rewardName} foi cancelada${reason ? `: ${reason}` : ""}. Devolvemos ${costStars} stars ao seu saldo.`;
  }
}

/** Avisa o cliente na conversa dele (portal do pedido ou WhatsApp). Best-effort: a decisão já está gravada. */
export async function notifyRedemptionCustomer(input: {
  leadId: string | null;
  requestedVia: LoyaltyRedemptionChannel;
  outcome: RedemptionOutcome;
  rewardName: string;
  costStars: number;
  reason?: string | null;
}) {
  if (!input.leadId || !REMOTE_CHANNELS.has(input.requestedVia)) return;
  const conversation = await prisma.conversation.findFirst({
    where: { leadId: input.leadId },
    select: { id: true },
  });
  if (!conversation) return;
  await deliverTextToLead({
    conversationId: conversation.id,
    senderName: "STAR FRIENDS",
    text: buildMessage(input.outcome, input.rewardName, input.costStars, input.reason ?? null),
    metadata: { kind: "star_friends_redemption", outcome: input.outcome },
  }).catch((error) => console.error("[star-friends] notify_redemption_failed", error));
}
