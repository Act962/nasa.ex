import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import { reactTrafegoStatusUpdateEmail } from "@/lib/email/trafego-status-update";
import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import {
  buildClientWhatsappText,
  buildStatusTemplateParameters,
  CLIENT_STATUS_COPY,
  type ClientNotificationContext,
} from "@/features/trafego/lib/client-notifications";
import { trafegoPanelUrl } from "@/features/trafego/lib/urls";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";
import { sendTrafegoClientWhatsapp } from "@/features/trafego/server/lib/send-client-whatsapp";

/**
 * Avisa o cliente (e-mail + WhatsApp) quando o pedido muda de fase.
 *
 * Evento: `trafego/order.status-changed` — emitido por `transitionTrafegoOrder`
 * e pelo pós-criação do pedido. Idempotente pelo `eventId`: retry do Inngest ou
 * evento duplicado não manda duas mensagens (`clientNotifiedAt` é o carimbo).
 */
export const trafegoOrderStatusChanged = inngest.createFunction(
  {
    id: "trafego-order-status-changed",
    retries: 3,
    idempotency: "event.data.eventId",
  },
  { event: "trafego/order.status-changed" },
  async ({ event, step }) => {
    const { orderId, eventId, toStatus } = event.data as {
      orderId: string;
      eventId: string;
      toStatus: TrafegoOrderStatus;
    };

    const payload = await step.run("load", async () => {
      const [order, orderEvent, settings] = await Promise.all([
        prisma.trafegoOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            code: true,
            businessName: true,
            leadId: true,
            owner: { select: { name: true, email: true, phone: true } },
            pendingPurchase: { select: { phone: true, email: true } },
          },
        }),
        prisma.trafegoOrderEvent.findUnique({
          where: { id: eventId },
          select: { id: true, detail: true, clientNotifiedAt: true, isClientVisible: true },
        }),
        loadTrafegoSettings({ fresh: true }),
      ]);
      return { order, orderEvent, settings };
    });

    const { order, orderEvent, settings } = payload;
    if (!order) return { skipped: "order_not_found", orderId };
    if (!orderEvent) return { skipped: "event_not_found", eventId };
    if (orderEvent.clientNotifiedAt) return { skipped: "already_notified", eventId };
    if (!orderEvent.isClientVisible) return { skipped: "internal_event", eventId };
    if (!settings.clientNotificationsEnabled) return { skipped: "notifications_disabled" };

    const copy = CLIENT_STATUS_COPY[toStatus];
    if (!copy) return { skipped: "silent_status", toStatus };

    const clientName = order.owner.name?.trim() || order.businessName || "cliente";
    const context: ClientNotificationContext = {
      clientName,
      orderCode: order.code,
      panelUrl: trafegoPanelUrl(order.id),
      supportWhatsapp: settings.supportWhatsapp,
      partnerBusinessId: settings.partnerBusinessId,
      clientNote: orderEvent.detail,
    };

    const email = await step.run("send-email", async () => {
      const to = order.pendingPurchase?.email ?? order.owner.email;
      if (!to) return { sent: false, reason: "no_email" };
      await resend.emails.send({
        from: "Nasaex <noreply@notifications.nasaex.com>",
        to,
        subject: copy.emailSubject(context),
        react: reactTrafegoStatusUpdateEmail({
          clientName,
          orderCode: order.code,
          statusTitle: copy.title,
          body: copy.body(context),
          panelUrl: context.panelUrl,
        }),
      });
      return { sent: true };
    });

    const whatsapp = await step.run("send-whatsapp", async () => {
      const text = buildClientWhatsappText(toStatus, context);
      if (!text) return { sent: false, reason: "no_copy" };
      return sendTrafegoClientWhatsapp({
        phone: order.pendingPurchase?.phone ?? order.owner.phone,
        leadId: order.leadId,
        text,
        template: {
          name: settings.whatsappStatusTemplate,
          language: settings.whatsappTemplateLanguage,
          bodyParameters: buildStatusTemplateParameters(toStatus, context),
        },
      });
    });

    await step.run("stamp", () =>
      prisma.trafegoOrderEvent.update({
        where: { id: eventId },
        data: { clientNotifiedAt: new Date() },
      }),
    );

    return { orderId, eventId, toStatus, email, whatsapp };
  },
);
