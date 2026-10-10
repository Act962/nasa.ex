import {
  NUMBER_COST_KINDS,
  currentBrazilMonth,
  listNumberCostEntries,
  loadNumberCostSummary,
} from "@/features/campanhas/server/lib/number-costs";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { canToggleInChatManual } from "@/features/tracking-chat/lib/can-toggle-in-chat-manual";
import { isSalvyConfigured } from "@/http/salvy/client";
import { latestWhatsAppCode, listAvailableAreaCodes, listSmsMessages } from "@/http/salvy/virtual-numbers";
import {
  buySalvyNumber,
  cancelSalvyNumber,
  getSalvyNumberMonthlyStars,
  toSalvyOrpcError,
} from "@/features/campanhas/server/lib/salvy-numbers";
import { loadMetaNumberPanel } from "@/features/campanhas/server/lib/meta-number-panel";
import { notifyTeamAboutNumberPurchase } from "@/features/campanhas/server/lib/notify-number-purchase";

const CODE_LOOKBACK_MS = 30 * 60_000;

export const numberOffer = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async () => {
    const monthlyStars = await getSalvyNumberMonthlyStars();
    const isAvailable = isSalvyConfigured() && monthlyStars !== null;
    const areaCodes = isAvailable ? await listAvailableAreaCodes().catch(() => []) : [];
    return { isAvailable, monthlyStars, areaCodes };
  });

export const listNumbers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) =>
    prisma.salvyVirtualNumber.findMany({
      where: { organizationId: context.org.id, status: { not: "canceled" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, phoneNumber: true, areaCode: true, status: true, trackingId: true, nextChargeAt: true, createdAt: true },
    }),
  );

export const buyNumber = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ areaCode: z.number().int().min(11).max(99), trackingId: z.string().optional() }))
  .handler(async ({ input, context, errors }) => {
    const { org, user } = context;
    if (!(await canToggleInChatManual(user.id, org.id))) {
      throw errors.FORBIDDEN({ message: "Só owner, admin ou moderador pode comprar número." });
    }
    if (input.trackingId) {
      const tracking = await prisma.tracking.findFirst({ where: { id: input.trackingId, organizationId: org.id }, select: { id: true } });
      if (!tracking) throw errors.NOT_FOUND({ message: "Tracking não encontrado." });
    }
    const number = await buySalvyNumber({
      organizationId: org.id,
      userId: user.id,
      trackingId: input.trackingId ?? null,
      areaCode: input.areaCode,
      label: org.name,
    });
    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      appSlug: "campanhas",
      action: "salvy_number.bought",
      actionLabel: `Comprou o número ${number.phoneNumber}`,
      resource: "salvy_virtual_number",
      resourceId: number.id,
    }).catch(() => {});
    return number;
  });

/** Consulta de SMS feita pelo assistente a cada poucos segundos (sem webhook). */
export const latestNumberCode = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ numberId: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    const number = await prisma.salvyVirtualNumber.findFirst({
      where: { id: input.numberId, organizationId: context.org.id },
      select: { salvyId: true },
    });
    if (!number) throw errors.NOT_FOUND({ message: "Número não encontrado." });
    try {
      const messages = await listSmsMessages(number.salvyId, new Date(Date.now() - CODE_LOOKBACK_MS));
      return latestWhatsAppCode(messages);
    } catch (error) {
      throw toSalvyOrpcError(error);
    }
  });

export const cancelNumber = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ numberId: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    if (!(await canToggleInChatManual(context.user.id, context.org.id))) {
      throw errors.FORBIDDEN({ message: "Só owner, admin ou moderador pode cancelar número." });
    }
    return cancelSalvyNumber(input.numberId, context.org.id);
  });

export const numberPanel = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ trackingId: z.string().min(1) }))
  .handler(async ({ input, context }) => loadMetaNumberPanel(input.trackingId, context.org.id));

const monthInput = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional();

/** Custos do número no mês: crédito, chamadas, mensagens, mensalidade e gasto guardado da Meta (spec 0087, RF-27). */
export const numberCostSummary = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ trackingId: z.string().min(1), month: monthInput }))
  .handler(async ({ input, context, errors }) => {
    await assertTrackingInOrg(input.trackingId, context.org.id, errors);
    return loadNumberCostSummary({ organizationId: context.org.id, trackingId: input.trackingId, month: input.month ?? currentBrazilMonth() });
  });

/** Histórico de custos do número no mês, com filtro por tipo. */
export const numberCostEntries = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ trackingId: z.string().min(1), month: monthInput, kind: z.enum(NUMBER_COST_KINDS).optional() }))
  .handler(async ({ input, context, errors }) => {
    await assertTrackingInOrg(input.trackingId, context.org.id, errors);
    return {
      entries: await listNumberCostEntries({
        organizationId: context.org.id,
        trackingId: input.trackingId,
        month: input.month ?? currentBrazilMonth(),
        kind: input.kind,
      }),
    };
  });

/** O número precisa ser da empresa ativa: sem isto, o id de outro tracking mostraria os custos alheios. */
async function assertTrackingInOrg(
  trackingId: string,
  organizationId: string,
  errors: { NOT_FOUND: (options: { message: string }) => Error },
): Promise<void> {
  const tracking = await prisma.tracking.findFirst({ where: { id: trackingId, organizationId }, select: { id: true } });
  if (!tracking) throw errors.NOT_FOUND({ message: "Número não encontrado." });
}

/** "Comprar número" no assistente: avisa a equipe do novo lead (o cliente fala com o comercial pelo WhatsApp dele). */
export const notifyNumberPurchaseInterest = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) =>
    notifyTeamAboutNumberPurchase({
      organizationName: context.org.name,
      userName: context.user.name,
      userEmail: context.user.email,
    }),
  );
