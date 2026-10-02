import "server-only";
import prisma from "@/lib/prisma";
import { sumBalance, toMemberPhone } from "../utils/balance";
import { lifetimeStarsFrom } from "../utils/tiers";

// Membro = cliente por telefone na org: o mesmo cliente pode ser lead em
// vários trackings, e as stars dele não podem se dividir entre eles.
export async function findOrCreateMemberForLead(organizationId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tracking: { organizationId } },
    select: { id: true, name: true, phone: true },
  });
  if (!lead?.phone) return null;
  const phone = toMemberPhone(lead.phone);
  return prisma.loyaltyMember.upsert({
    where: { organizationId_phone: { organizationId, phone } },
    create: { organizationId, phone, name: lead.name, lastLeadId: lead.id },
    update: { lastLeadId: lead.id },
  });
}

export async function findMemberForLead(organizationId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tracking: { organizationId } },
    select: { phone: true },
  });
  if (!lead?.phone) return null;
  return prisma.loyaltyMember.findUnique({
    where: { organizationId_phone: { organizationId, phone: toMemberPhone(lead.phone) } },
  });
}

export async function getMemberBalance(memberId: string): Promise<number> {
  const aggregate = await prisma.loyaltyLedgerEntry.aggregate({
    where: { memberId },
    _sum: { stars: true },
  });
  return aggregate._sum.stars ?? 0;
}

export async function getBalancesForMembers(memberIds: string[]): Promise<Map<string, number>> {
  if (memberIds.length === 0) return new Map();
  const grouped = await prisma.loyaltyLedgerEntry.groupBy({
    by: ["memberId"],
    where: { memberId: { in: memberIds } },
    _sum: { stars: true },
  });
  return new Map(grouped.map((row) => [row.memberId, row._sum.stars ?? 0]));
}

export { sumBalance };

export async function getMemberLifetimeStars(memberId: string): Promise<number> {
  const grouped = await prisma.loyaltyLedgerEntry.groupBy({
    by: ["type"],
    where: { memberId },
    _sum: { stars: true },
  });
  return lifetimeStarsFrom(grouped.map((row) => ({ type: row.type, stars: row._sum.stars ?? 0 })));
}

/** Stars "na vida" de cada membro (base do nível), numa consulta só para a página inteira. */
export async function getLifetimeStarsForMembers(memberIds: string[]): Promise<Map<string, number>> {
  if (memberIds.length === 0) return new Map();
  const grouped = await prisma.loyaltyLedgerEntry.groupBy({
    by: ["memberId", "type"],
    where: { memberId: { in: memberIds } },
    _sum: { stars: true },
  });
  const entriesByMember = new Map<string, { type: string; stars: number }[]>();
  for (const row of grouped) {
    const memberEntries = entriesByMember.get(row.memberId) ?? [];
    memberEntries.push({ type: row.type, stars: row._sum.stars ?? 0 });
    entriesByMember.set(row.memberId, memberEntries);
  }
  return new Map([...entriesByMember].map(([memberId, entries]) => [memberId, lifetimeStarsFrom(entries)]));
}

/** Último lançamento de stars de cada membro (compra, troca, ajuste ou expiração). */
export async function getLastActivityForMembers(memberIds: string[]): Promise<Map<string, Date>> {
  if (memberIds.length === 0) return new Map();
  const grouped = await prisma.loyaltyLedgerEntry.groupBy({
    by: ["memberId"],
    where: { memberId: { in: memberIds } },
    _max: { createdAt: true },
  });
  return new Map(
    grouped.flatMap((row) => (row._max.createdAt ? [[row.memberId, row._max.createdAt] as const] : [])),
  );
}
