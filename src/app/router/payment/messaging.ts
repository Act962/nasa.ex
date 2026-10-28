import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { findConnectedOrganizationInstance } from "@/features/tracking-chat/lib/providers/send-org-document";

// Spec 0115: tracking cujo número de WhatsApp envia a régua e os lembretes do financeiro.

const senderOptionSchema = z.object({
  trackingId:   z.string(),
  trackingName: z.string(),
  phoneNumber:  z.string().nullable(),
  provider:     z.enum(["UAZAPI", "META_CLOUD"]),
  isConnected:  z.boolean(),
});

export const getPaymentMessagingSender = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("settings", "view"))
  .route({ method: "GET", summary: "Get the tracking that sends payment WhatsApp messages", tags: ["Payment"] })
  .input(z.object({}))
  .output(z.object({
    selectedTrackingId: z.string().nullable(),
    fallbackTrackingId: z.string().nullable(),
    options:            z.array(senderOptionSchema),
  }))
  .handler(async ({ context }) => {
    const [config, instances, fallbackInstance] = await Promise.all([
      prisma.paymentGovernanceConfig.findUnique({
        where:  { organizationId: context.org.id },
        select: { messagingTrackingId: true },
      }),
      prisma.whatsAppInstance.findMany({
        where:   { organizationId: context.org.id, tracking: { isArchived: false } },
        select:  { trackingId: true, phoneNumber: true, provider: true, status: true, tracking: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take:    100,
      }),
      findConnectedOrganizationInstance(context.org.id),
    ]);

    return {
      selectedTrackingId: config?.messagingTrackingId ?? null,
      fallbackTrackingId: fallbackInstance?.trackingId ?? null,
      options: instances.map((instance) => ({
        trackingId:   instance.trackingId,
        trackingName: instance.tracking.name,
        phoneNumber:  instance.phoneNumber,
        provider:     instance.provider,
        isConnected:  instance.status === "CONNECTED",
      })),
    };
  });

export const setPaymentMessagingSender = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("settings", "edit"))
  .route({ method: "POST", summary: "Set the tracking that sends payment WhatsApp messages", tags: ["Payment"] })
  .input(z.object({ trackingId: z.string().nullable() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    if (input.trackingId) {
      const instance = await prisma.whatsAppInstance.findFirst({
        where:  { organizationId: context.org.id, trackingId: input.trackingId },
        select: { id: true },
      });
      if (!instance) throw errors.BAD_REQUEST({ message: "Esse tracking não tem WhatsApp nesta empresa." });
    }

    await prisma.paymentGovernanceConfig.upsert({
      where:  { organizationId: context.org.id },
      create: { organizationId: context.org.id, messagingTrackingId: input.trackingId },
      update: { messagingTrackingId: input.trackingId },
    });

    await logActivity({
      organizationId: context.org.id,
      userId:      context.user.id,
      userName:    context.user.name,
      userEmail:   context.user.email,
      appSlug:     "payment",
      subAppSlug:  "payment-dunning",
      featureKey:  "payment.messaging.sender_updated",
      action:      "payment.messaging.sender_updated",
      actionLabel: "Escolheu o número que envia as cobranças",
      resource:    "payment-messaging",
      metadata:    input,
    });

    return { success: true };
  });
