import "server-only";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { LoyaltyLedgerSource } from "@/generated/prisma/enums";
import { getActiveProgram } from "./program";
import { findOrCreateMemberForLead } from "./members";
import { SYSTEM_ACTOR } from "./actor";
import { auditLoyaltyAction } from "./audit";

export type PurchaseItemSnapshot = { name: string; quantity: number; total: number };

// Idempotente pela chave única (source, sourceId, EARN): webhook, polling e
// mudança manual de status podem chamar mais de uma vez para a mesma compra.
export async function awardPurchaseStars(input: {
  organizationId: string;
  source: Extract<LoyaltyLedgerSource, "CATALOG_ORDER" | "FORGE_PROPOSAL">;
  sourceId: string;
  leadId: string;
  amount: number;
  items: PurchaseItemSnapshot[];
  purchaseLabel: string;
}) {
  const program = await getActiveProgram(input.organizationId);
  if (!program) return { awarded: false as const, reason: "program_inactive" };
  const isSourceEnabled =
    input.source === "CATALOG_ORDER" ? program.countCatalogOrders : program.countForgeProposals;
  if (!isSourceEnabled) return { awarded: false as const, reason: "source_disabled" };
  if (input.amount < Number(program.minPurchaseAmount)) {
    return { awarded: false as const, reason: "below_minimum" };
  }

  const member = await findOrCreateMemberForLead(input.organizationId, input.leadId);
  if (!member) return { awarded: false as const, reason: "lead_without_phone" };

  const expiresAt = program.starsExpireDays
    ? new Date(Date.now() + program.starsExpireDays * 24 * 60 * 60 * 1000)
    : null;

  try {
    await prisma.loyaltyLedgerEntry.create({
      data: {
        organizationId: input.organizationId,
        memberId: member.id,
        leadId: input.leadId,
        type: "EARN",
        stars: program.starsPerPurchase,
        source: input.source,
        sourceId: input.sourceId,
        itemsSnapshot: { purchase: input.purchaseLabel, amount: input.amount, items: input.items },
        actorType: SYSTEM_ACTOR.type,
        actorName: SYSTEM_ACTOR.name,
        expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { awarded: false as const, reason: "already_awarded" };
    }
    throw error;
  }

  await auditLoyaltyAction({
    organizationId: input.organizationId,
    actor: SYSTEM_ACTOR,
    action: "stars.earned",
    actionLabel: `+${program.starsPerPurchase} star(s) para ${member.name} — ${input.purchaseLabel}`,
    leadId: input.leadId,
    resourceId: member.id,
    metadata: { source: input.source, sourceId: input.sourceId, amount: input.amount },
  });
  return { awarded: true as const, stars: program.starsPerPurchase };
}
