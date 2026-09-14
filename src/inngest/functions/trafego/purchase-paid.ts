import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import { reactTrafegoPurchaseConfirmationEmail } from "@/lib/email/trafego-purchase-confirmation";
import {
  PLATFORM_SHORT_LABEL,
  OBJECTIVE_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { trafegoActivationUrl } from "@/features/trafego/lib/urls";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";
import { sendTrafegoClientWhatsapp } from "@/features/trafego/server/lib/send-client-whatsapp";
import { moveTrafegoLeadToColumn } from "@/features/trafego/server/lib/lead-card";

const EXPIRES_IN_DAYS = 7;

/**
 * Dispara após a compra ser marcada como PAID (Stripe ou PIX confirmado).
 * Envia o link de ativação (`/trafego/ativar/<signupToken>`) por e-mail e
 * WhatsApp, e move o card do cliente para "Pagamento confirmado".
 *
 * Evento: `trafego/purchase.paid` — emitido em `/api/trafego/webhook`.
 */
export const trafegoPurchasePaid = inngest.createFunction(
  { id: "trafego-purchase-paid", retries: 3 },
  { event: "trafego/purchase.paid" },
  async ({ event, step }) => {
    const { pendingId } = event.data as { pendingId: string };

    const pending = await step.run("load-pending", async () =>
      prisma.trafegoPendingPurchase.findUnique({
        where: { id: pendingId },
        select: {
          id: true,
          email: true,
          phone: true,
          companyName: true,
          briefing: true,
          leadId: true,
          status: true,
          platform: true,
          objective: true,
          adBudgetBrlCents: true,
          serviceFeePercent: true,
          serviceFeeBrlCents: true,
          setupFeeBrlCents: true,
          amountBrlCents: true,
          signupToken: true,
          tokenExpiresAt: true,
          plan: { select: { name: true, durationDays: true } },
        },
      }),
    );

    if (!pending) return { skipped: "pending_not_found", pendingId };
    if (pending.status !== "PAID") return { skipped: "not_paid", pendingId };
    if (!pending.signupToken) return { skipped: "missing_signup_token", pendingId };

    const activationLink = trafegoActivationUrl(pending.signupToken);

    await step.run("send-email", async () => {
      await resend.emails.send({
        from: "Nasaex <noreply@notifications.nasaex.com>",
        to: pending.email,
        subject: "Pagamento confirmado — ative sua campanha",
        react: reactTrafegoPurchaseConfirmationEmail({
          email: pending.email,
          planName: pending.plan?.name ?? "Sua campanha",
          platformLabel: PLATFORM_SHORT_LABEL[pending.platform],
          objectiveLabel: OBJECTIVE_LABEL[pending.objective],
          adBudgetBrl: pending.adBudgetBrlCents / 100,
          serviceFeePercent: pending.serviceFeePercent,
          serviceFeeBrl: pending.serviceFeeBrlCents / 100,
          setupFeeBrl: pending.setupFeeBrlCents / 100,
          totalBrl: pending.amountBrlCents / 100,
          durationDays: pending.plan?.durationDays ?? 30,
          activationLink,
          expiresInDays: EXPIRES_IN_DAYS,
        }),
      });
    });

    const whatsapp = await step.run("send-whatsapp", async () => {
      const settings = await loadTrafegoSettings({ fresh: true });
      const briefing = (pending.briefing ?? {}) as Record<string, unknown>;
      const businessName =
        (typeof briefing.businessName === "string" && briefing.businessName.trim()) ||
        pending.companyName ||
        "";
      const clientName = businessName || pending.email;
      const total = formatBrlFromCents(pending.amountBrlCents);
      return sendTrafegoClientWhatsapp({
        phone: pending.phone,
        leadId: pending.leadId,
        text: `Pagamento confirmado ✅\n\nOi! Recebemos ${total} da sua campanha trafeGO${businessName ? ` (${businessName})` : ""}. Falta um passo: crie sua senha para acessar o painel, enviar os criativos e escolher a copy.\n\nAtivar minha conta: ${activationLink}\n\nLink válido por ${EXPIRES_IN_DAYS} dias.`,
        template: {
          name: settings.whatsappActivationTemplate,
          language: settings.whatsappTemplateLanguage,
          bodyParameters: [clientName, total, activationLink],
        },
      });
    });

    const card = await step.run("move-card", async () => {
      if (!pending.leadId) return "no_lead";
      return moveTrafegoLeadToColumn({
        leadId: pending.leadId,
        columnKey: "PAID",
        note: "trafeGO: pagamento confirmado",
      });
    });

    return { sent: true, pendingId, whatsapp, card };
  },
);
