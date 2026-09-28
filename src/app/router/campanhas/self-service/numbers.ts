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
