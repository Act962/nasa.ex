import { z } from "zod";
import prisma from "@/lib/prisma";
import { getPresignedReadUrl } from "@/lib/r2-url";
import { userActor } from "@/features/star-friends/lib/actor";
import { auditLoyaltyAction } from "@/features/star-friends/lib/audit";
import { drawCampaignWinner } from "@/features/star-friends/lib/campaign/draw";
import { sweepCampaignDuplicates } from "@/features/star-friends/lib/campaign/sweep-duplicates";
import { onlyDigits, rulesVersionOf } from "@/features/star-friends/utils/campaign";
import { starFriendsWith } from "./_base";

// Campanha de sorteio por cupom (spec 0102). Fotos de cupom e dados de participante só saem
// daqui, com a permissão do app; nada disso existe em rota pública.

const RECEIPTS_PAGE_SIZE = 30;
const EXPORT_LIMIT = 20_000;
const RECEIPT_PHOTO_TTL_SECONDS = 600;

const CAMPAIGN_ERRORS: Record<string, string> = {
  not_found: "Campanha não encontrada.",
  already_drawn: "Esta campanha já foi sorteada.",
  sweep_required: "Faça a varredura de duplicados antes de sortear: há cupons que ainda não passaram por ela.",
  no_numbers: "Não há números válidos para sortear.",
};

export const getStarFriendsCampaign = starFriendsWith("canView")
  .input(z.object({}))
  .handler(async ({ context }) => {
    const campaign = await prisma.loyaltyCampaign.findFirst({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
    });
    const trackings = await prisma.tracking.findMany({
      where: { organizationId: context.org.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    if (!campaign) return { campaign: null, stats: null, winner: null, trackings };

    const [participants, receiptsByStatus, flaggedReceipts, validNumbers, voidedNumbers, receiptsAfterSweep, winner] = await Promise.all([
      prisma.loyaltyCampaignEntry.count({ where: { campaignId: campaign.id } }),
      prisma.loyaltyReceipt.groupBy({ by: ["status"], where: { campaignId: campaign.id }, _count: { _all: true }, _sum: { totalCents: true } }),
      prisma.loyaltyReceipt.count({ where: { campaignId: campaign.id, status: "ACCEPTED", isFlagged: true } }),
      prisma.loyaltyLuckyNumber.count({ where: { campaignId: campaign.id, status: "VALID" } }),
      prisma.loyaltyLuckyNumber.count({ where: { campaignId: campaign.id, status: "VOIDED" } }),
      prisma.loyaltyReceipt.count({
        where: { campaignId: campaign.id, status: "ACCEPTED", ...(campaign.lastSweepAt ? { createdAt: { gt: campaign.lastSweepAt } } : {}) },
      }),
      campaign.winnerNumberId
        ? prisma.loyaltyLuckyNumber.findUnique({
            where: { id: campaign.winnerNumberId },
            select: { code: true, member: { select: { name: true, phone: true } } },
          })
        : Promise.resolve(null),
    ]);
    const countOf = (status: string) => receiptsByStatus.find((row) => row.status === status)?._count._all ?? 0;
    return {
      campaign,
      trackings,
      stats: {
        participants,
        acceptedReceipts: countOf("ACCEPTED"),
        duplicateReceipts: countOf("DUPLICATE"),
        rejectedReceipts: countOf("REJECTED"),
        voidedReceipts: countOf("VOIDED"),
        flaggedReceipts,
        acceptedTotalCents: receiptsByStatus.find((row) => row.status === "ACCEPTED")?._sum.totalCents ?? 0,
        validNumbers,
        voidedNumbers,
        receiptsAfterSweep,
      },
      winner: winner ? { code: winner.code, name: winner.member.name, phone: winner.member.phone } : null,
    };
  });

export const upsertStarFriendsCampaign = starFriendsWith("canEdit")
  .input(
    z
      .object({
        id: z.string().optional(),
        name: z.string().trim().min(3).max(80),
        isActive: z.boolean(),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date(),
        amountPerNumberCents: z.number().int().min(100).max(100_000_00),
        issuerDocuments: z.array(z.string()).max(10),
        rulesSummary: z.string().trim().min(20).max(700),
        rulesUrl: z.string().trim().url().max(300).nullable(),
        trackingId: z.string().nullable(),
        maxReceiptsPerDay: z.number().int().min(1).max(50),
      })
      .refine((campaign) => campaign.endsAt > campaign.startsAt, { message: "O fim precisa ser depois do início." }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const existing = input.id
      ? await prisma.loyaltyCampaign.findFirst({ where: { id: input.id, organizationId }, select: { id: true, drawnAt: true } })
      : null;
    if (input.id && !existing) throw errors.NOT_FOUND({ message: "Campanha não encontrada." });
    if (existing?.drawnAt) throw errors.BAD_REQUEST({ message: "Esta campanha já foi sorteada e não pode mais ser alterada." });
    if (input.trackingId) {
      const tracking = await prisma.tracking.findFirst({ where: { id: input.trackingId, organizationId }, select: { id: true } });
      if (!tracking) throw errors.BAD_REQUEST({ message: "Funil não encontrado nesta empresa." });
    }
    const issuerDocuments = [...new Set(input.issuerDocuments.map((document) => onlyDigits(document)).filter((document) => document.length === 14))];
    const data = {
      name: input.name,
      isActive: input.isActive,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      amountPerNumberCents: input.amountPerNumberCents,
      issuerDocuments,
      rulesSummary: input.rulesSummary,
      rulesUrl: input.rulesUrl,
      rulesVersion: rulesVersionOf(input.rulesSummary, input.rulesUrl),
      trackingId: input.trackingId,
      maxReceiptsPerDay: input.maxReceiptsPerDay,
    };
    const saved = await prisma.$transaction(async (tx) => {
      // Uma campanha ativa por empresa: o atendimento precisa saber, sem dúvida, qual é a do cupom.
      if (input.isActive) {
        await tx.loyaltyCampaign.updateMany({
          where: { organizationId, isActive: true, ...(existing ? { id: { not: existing.id } } : {}) },
          data: { isActive: false },
        });
      }
      return existing
        ? tx.loyaltyCampaign.update({ where: { id: existing.id }, data, select: { id: true } })
        : tx.loyaltyCampaign.create({ data: { ...data, organizationId }, select: { id: true } });
    });
    await auditLoyaltyAction({
      organizationId,
      actor: userActor(context.user),
      action: existing ? "campaign.updated" : "campaign.created",
      actionLabel: `Campanha "${input.name}" ${existing ? "atualizada" : "criada"}${input.isActive ? " (ativa)" : ""}`,
      resourceId: saved.id,
    });
    return { id: saved.id };
  });

export const listStarFriendsCampaignReceipts = starFriendsWith("canView")
  .input(
    z.object({
      campaignId: z.string(),
      filter: z.enum(["ALL", "ACCEPTED", "FLAGGED", "DUPLICATE", "REJECTED", "VOIDED"]).default("ALL"),
      cursor: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const receipts = await prisma.loyaltyReceipt.findMany({
      where: {
        campaignId: input.campaignId,
        organizationId: context.org.id,
        ...(input.filter === "FLAGGED" ? { status: "ACCEPTED", isFlagged: true } : input.filter === "ALL" ? {} : { status: input.filter }),
      },
      orderBy: { createdAt: "desc" },
      take: RECEIPTS_PAGE_SIZE + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        status: true,
        isFlagged: true,
        flagReasons: true,
        rejectReason: true,
        totalCents: true,
        issuedAt: true,
        issuerDocument: true,
        receiptNumber: true,
        numbersAwarded: true,
        fileKey: true,
        fileSize: true,
        mimetype: true,
        leadId: true,
        createdAt: true,
        member: { select: { name: true, phone: true } },
        luckyNumbers: { select: { code: true, status: true } },
      },
    });
    const page = receipts.slice(0, RECEIPTS_PAGE_SIZE);
    return {
      receipts: await Promise.all(
        page.map(async ({ fileKey, ...receipt }) => ({
          ...receipt,
          photoUrl: fileKey ? await getPresignedReadUrl(fileKey, RECEIPT_PHOTO_TTL_SECONDS).catch(() => null) : null,
        })),
      ),
      nextCursor: receipts.length > RECEIPTS_PAGE_SIZE ? page[page.length - 1]?.id : null,
    };
  });

export const exportStarFriendsCampaignNumbers = starFriendsWith("canView")
  .input(z.object({ campaignId: z.string() }))
  .handler(async ({ input, context }) => {
    const luckyNumbers = await prisma.loyaltyLuckyNumber.findMany({
      where: { campaignId: input.campaignId, campaign: { organizationId: context.org.id } },
      orderBy: { code: "asc" },
      take: EXPORT_LIMIT,
      select: {
        code: true,
        status: true,
        voidReason: true,
        createdAt: true,
        member: { select: { name: true, phone: true } },
        receipt: { select: { totalCents: true, issuedAt: true, receiptNumber: true } },
      },
    });
    return { luckyNumbers };
  });

export const sweepStarFriendsCampaign = starFriendsWith("canApprove")
  .input(z.object({ campaignId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const result = await sweepCampaignDuplicates({ organizationId: context.org.id, campaignId: input.campaignId, actor: userActor(context.user) });
    if (!result.ok) throw errors.BAD_REQUEST({ message: CAMPAIGN_ERRORS[result.reason] });
    return result;
  });

export const drawStarFriendsCampaign = starFriendsWith("canApprove")
  .input(z.object({ campaignId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const result = await drawCampaignWinner({ organizationId: context.org.id, campaignId: input.campaignId, actor: userActor(context.user) });
    if (!result.ok) throw errors.BAD_REQUEST({ message: CAMPAIGN_ERRORS[result.reason] });
    return result;
  });
