import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

// Detecta, antes de mover, quais leads selecionados já têm uma cópia (mesmo
// telefone) no tracking de destino — esses viram candidatos a MESCLAR em vez de
// estourar o unique (phone, trackingId). Retorna também os leads sem conflito,
// que movem normalmente.

const LEAD_PREVIEW_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  temperature: true,
  amount: true,
  statusId: true,
  trackingId: true,
  responsible: { select: { id: true, name: true } },
  status: { select: { name: true } },
  _count: {
    select: {
      leadTags: true,
      files: true,
      formResponses: true,
      actions: true,
    },
  },
} as const;

export const detectMergeConflicts = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Detecta duplicatas no tracking de destino" })
  .input(
    z.object({
      leadIds: z.array(z.string()).min(1),
      targetTrackingId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const sourceLeads = await prisma.lead.findMany({
      where: { id: { in: input.leadIds } },
      select: { ...LEAD_PREVIEW_SELECT, tracking: { select: { organizationId: true } } },
    });
    if (sourceLeads.length === 0) throw errors.NOT_FOUND;

    const targetTracking = await prisma.tracking.findUnique({
      where: { id: input.targetTrackingId },
      select: { organizationId: true },
    });
    if (!targetTracking) throw errors.NOT_FOUND;

    // Todos os leads + o destino têm que ser da mesma org do caller.
    const organizationId = targetTracking.organizationId;
    const sameOrg = sourceLeads.every(
      (lead) => lead.tracking.organizationId === organizationId,
    );
    if (!sameOrg) throw errors.FORBIDDEN;

    const isMember = await prisma.member.findFirst({
      where: { userId: context.user.id, organizationId },
      select: { id: true },
    });
    if (!isMember) throw errors.FORBIDDEN;

    // Telefones dos leads selecionados que NÃO estão já no tracking de destino.
    const candidatePhones = sourceLeads
      .filter(
        (lead) => lead.phone && lead.trackingId !== input.targetTrackingId,
      )
      .map((lead) => lead.phone as string);

    const targetDuplicates = candidatePhones.length
      ? await prisma.lead.findMany({
          where: {
            trackingId: input.targetTrackingId,
            phone: { in: candidatePhones },
          },
          select: LEAD_PREVIEW_SELECT,
        })
      : [];

    const targetByPhone = new Map(
      targetDuplicates.map((lead) => [lead.phone as string, lead]),
    );

    // Decimal → number pra o tipo do client ficar simples e serializável.
    const serialize = <T extends { amount: Prisma.Decimal }>(lead: T) => ({
      ...lead,
      amount: lead.amount.toNumber(),
    });

    const findDuplicate = (lead: (typeof sourceLeads)[number]) =>
      lead.phone && lead.trackingId !== input.targetTrackingId
        ? targetByPhone.get(lead.phone)
        : undefined;

    const conflicts = sourceLeads.flatMap((lead) => {
      const duplicate = findDuplicate(lead);
      return duplicate && duplicate.id !== lead.id
        ? [{ source: serialize(lead), target: serialize(duplicate) }]
        : [];
    });

    const cleanLeadIds = sourceLeads
      .filter((lead) => {
        const duplicate = findDuplicate(lead);
        return !(duplicate && duplicate.id !== lead.id);
      })
      .map((lead) => lead.id);

    return { conflicts, cleanLeadIds };
  });
