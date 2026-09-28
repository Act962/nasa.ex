import "server-only";
import prisma from "@/lib/prisma";
import { sumBalance, toMemberPhone } from "../utils/balance";

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
