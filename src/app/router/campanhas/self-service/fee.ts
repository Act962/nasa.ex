import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireSystemAdminMiddleware } from "@/app/middlewares/system-admin";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";
import { assertBroadcastSendable } from "@/features/campanhas/server/lib/assert-broadcast-sendable";
import {
  buildBroadcastQuote,
  confirmFeePayment,
  loadBroadcastFeeSettings,
  startFeeCheckout,
} from "@/features/campanhas/server/lib/broadcast-fee-service";

const broadcastIdInput = z.object({ broadcastId: z.string().min(1) });

export const quoteFee = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(broadcastIdInput)
  .handler(async ({ input, context }) => {
    const broadcast = await loadBroadcastForOrg(input.broadcastId, context.org.id);
    const [quote, payments] = await Promise.all([
      buildBroadcastQuote(broadcast, context.org.id),
      prisma.broadcastFeePayment.findMany({
        where: { broadcastId: broadcast.id, status: { in: ["PENDING", "PAID"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          provider: true,
          recipients: true,
          serviceFeeBrlCents: true,
          checkoutUrl: true,
          paidAt: true,
          createdAt: true,
        },
      }),
    ]);
    return { quote, payments };
  });

export const checkoutFee = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      broadcastId: z.string().min(1),
      paymentMethod: z.enum(["CARD", "PIX"]),
      payerDocument: z.string().max(20).optional(),
      dispatchMode: z.enum(["NOW", "SCHEDULE"]).default("NOW"),
      scheduledAt: z.string().datetime().optional(),
      returnPath: z.string().startsWith("/").max(300),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { org, user } = context;
    const broadcast = await loadBroadcastForOrg(input.broadcastId, org.id);
    await assertBroadcastSendable(broadcast, org.id);

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (input.dispatchMode === "SCHEDULE" && (!scheduledAt || scheduledAt.getTime() <= Date.now())) {
      throw errors.BAD_REQUEST({ message: "Escolha uma data e hora futura para o agendamento." });
    }

    const origin = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const checkout = await startFeeCheckout({
      broadcast,
      organizationId: org.id,
      user: { id: user.id, name: user.name, email: user.email },
      paymentMethod: input.paymentMethod,
      payerDocument: input.payerDocument,
      dispatchMode: input.dispatchMode,
      scheduledAt,
      returnUrl: `${origin.replace(/\/$/, "")}${input.returnPath}`,
    });

    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      appSlug: "campanhas",
      action: "broadcast.fee_checkout",
      actionLabel: `Abriu o pagamento da taxa da campanha "${broadcast.name}"`,
      resource: "broadcast",
      resourceId: broadcast.id,
      metadata: { paymentId: checkout.paymentId, paymentMethod: input.paymentMethod },
    }).catch(() => {});

    return checkout;
  });

export const confirmFee = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ paymentId: z.string().min(1) }))
  .handler(async ({ input, context }) => confirmFeePayment(input.paymentId, context.org.id));

const tierSchema = z.object({
  minMetaCostBrlCents: z.number().int().min(0),
  feePercent: z.number().min(0).max(100),
});

export const getFeeSettings = base
  .use(requiredAuthMiddleware)
  .use(requireSystemAdminMiddleware)
  .handler(async () => loadBroadcastFeeSettings());

export const updateFeeSettings = base
  .use(requiredAuthMiddleware)
  .use(requireSystemAdminMiddleware)
  .input(
    z.object({
      enabled: z.boolean(),
      tiers: z.array(tierSchema).min(1).max(10),
      minFeeBrlCents: z.number().int().min(0),
    }),
  )
  .handler(async ({ input }) => {
    const data = { enabled: input.enabled, tiers: input.tiers, minFeeBrlCents: input.minFeeBrlCents };
    await prisma.broadcastFeeSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...data },
      update: data,
    });
    return loadBroadcastFeeSettings();
  });
