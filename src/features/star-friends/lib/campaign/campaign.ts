import "server-only";
import prisma from "@/lib/prisma";
import { findOrCreateMemberForLead, getMemberBalance } from "../members";

// Leituras e cadastro da campanha de sorteio (spec 0102). Tudo aqui parte do participante
// resolvido pelo lead da conversa: nenhuma função aceita telefone digitado pelo cliente (D-2).

export type CampaignAvailability = "open" | "not_started" | "ended";

export async function findActiveCampaign(organizationId: string, trackingId: string) {
  return prisma.loyaltyCampaign.findFirst({
    where: { organizationId, isActive: true, OR: [{ trackingId }, { trackingId: null }] },
    orderBy: { createdAt: "desc" },
  });
}

export type ActiveCampaign = NonNullable<Awaited<ReturnType<typeof findActiveCampaign>>>;

export function campaignAvailabilityAt(campaign: { startsAt: Date; endsAt: Date }, now: Date): CampaignAvailability {
  if (now < campaign.startsAt) return "not_started";
  if (now > campaign.endsAt) return "ended";
  return "open";
}

export async function findCampaignEntryForLead(params: { organizationId: string; campaignId: string; leadId: string }) {
  const member = await findOrCreateMemberForLead(params.organizationId, params.leadId);
  if (!member) return { member: null, entry: null };
  const entry = await prisma.loyaltyCampaignEntry.findUnique({
    where: { campaignId_memberId: { campaignId: params.campaignId, memberId: member.id } },
  });
  return { member, entry };
}

export async function registerCampaignEntry(params: {
  organizationId: string;
  campaignId: string;
  rulesVersion: string;
  leadId: string;
  customerName: string;
}) {
  const member = await findOrCreateMemberForLead(params.organizationId, params.leadId);
  if (!member) return null;
  const [entry] = await prisma.$transaction([
    prisma.loyaltyCampaignEntry.upsert({
      where: { campaignId_memberId: { campaignId: params.campaignId, memberId: member.id } },
      create: {
        campaignId: params.campaignId,
        memberId: member.id,
        registeredPhone: member.phone,
        acceptedRulesVersion: params.rulesVersion,
      },
      update: {},
    }),
    prisma.loyaltyMember.update({ where: { id: member.id }, data: { name: params.customerName } }),
    prisma.lead.update({ where: { id: params.leadId }, data: { name: params.customerName } }),
  ]);
  return { member, entry };
}

export async function getMemberCampaignSummary(params: { campaignId: string; memberId: string }) {
  const [entry, validNumbers, acceptedReceipts, starsBalance] = await Promise.all([
    prisma.loyaltyCampaignEntry.findUnique({
      where: { campaignId_memberId: { campaignId: params.campaignId, memberId: params.memberId } },
      select: { carryOverCents: true, totalSpentCents: true },
    }),
    prisma.loyaltyLuckyNumber.count({ where: { campaignId: params.campaignId, memberId: params.memberId, status: "VALID" } }),
    prisma.loyaltyReceipt.count({ where: { campaignId: params.campaignId, memberId: params.memberId, status: "ACCEPTED" } }),
    getMemberBalance(params.memberId),
  ]);
  return {
    totalSpentCents: entry?.totalSpentCents ?? 0,
    carryOverCents: entry?.carryOverCents ?? 0,
    validNumbers,
    acceptedReceipts,
    starsBalance,
  };
}

export async function listMemberLuckyCodes(params: { campaignId: string; memberId: string }): Promise<string[]> {
  const luckyNumbers = await prisma.loyaltyLuckyNumber.findMany({
    where: { campaignId: params.campaignId, memberId: params.memberId, status: "VALID" },
    orderBy: { createdAt: "asc" },
    select: { code: true },
  });
  return luckyNumbers.map((luckyNumber) => luckyNumber.code);
}
