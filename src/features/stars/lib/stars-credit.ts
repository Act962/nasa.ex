import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";

/**
 * A empresa tem crédito (Stars) para os recursos que dependem dele: chamada de
 * voz e disparo em massa (spec 0087, Parte F). Só leitura, sem efeito colateral.
 * As demais funções seguem as regras de cobrança de sempre.
 */
export async function hasStarsCredit(organizationId: string): Promise<boolean> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { starsBalance: true, starsBonusBalance: true, starsSuspendedAt: true },
  });
  if (!organization || organization.starsSuspendedAt) return false;
  return organization.starsBalance + organization.starsBonusBalance > 0;
}

export const NO_CREDIT_FOR_BROADCAST_MESSAGE =
  "Sua empresa está sem crédito (Stars). Recarregue para disparar campanhas. As demais funções continuam disponíveis.";

/** Para procedures: sem crédito, o disparo não começa nem é agendado. */
export async function assertStarsCreditForBroadcast(organizationId: string): Promise<void> {
  if (await hasStarsCredit(organizationId)) return;
  throw new ORPCError("PRECONDITION_FAILED", {
    message: NO_CREDIT_FOR_BROADCAST_MESSAGE,
    data: { reason: "NO_CREDIT" },
  });
}
