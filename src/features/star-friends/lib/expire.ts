import "server-only";
import prisma from "@/lib/prisma";
import { starsToExpire } from "../utils/balance";
import { SYSTEM_ACTOR } from "./actor";
import { getMemberBalance } from "./members";

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

// Uma entrada EXPIRE por EARN vencido (sourceId = id do EARN) — a chave
// única impede expirar a mesma compra duas vezes. A janela de 7 dias cobre
// execuções do cron que falharem sem varrer o histórico inteiro a cada dia.
export async function expireDueStars(now = new Date()) {
  const dueEarns = await prisma.loyaltyLedgerEntry.findMany({
    where: { type: "EARN", expiresAt: { lte: now, gte: new Date(now.getTime() - LOOKBACK_MS) } },
    select: { id: true, organizationId: true, memberId: true, leadId: true, stars: true },
    take: 500,
  });
  const alreadyExpired = new Set(
    (
      await prisma.loyaltyLedgerEntry.findMany({
        where: { type: "EXPIRE", sourceId: { in: dueEarns.map((earn) => earn.id) } },
        select: { sourceId: true },
      })
    ).map((entry) => entry.sourceId),
  );

  let expiredCount = 0;
  for (const earn of dueEarns) {
    if (alreadyExpired.has(earn.id)) continue;
    const balance = await getMemberBalance(earn.memberId);
    const stars = starsToExpire(earn.stars, balance);
    await prisma.loyaltyLedgerEntry.create({
      data: {
        organizationId: earn.organizationId,
        memberId: earn.memberId,
        leadId: earn.leadId,
        type: "EXPIRE",
        stars: -stars,
        source: "MANUAL",
        sourceId: earn.id,
        reason: "Validade das stars vencida",
        actorType: SYSTEM_ACTOR.type,
        actorName: SYSTEM_ACTOR.name,
      },
    });
    expiredCount += 1;
  }
  return { expiredCount };
}
