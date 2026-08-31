import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import { reactTrafegoPurchaseConfirmationEmail } from "@/lib/email/trafego-purchase-confirmation";
import {
  PLATFORM_SHORT_LABEL,
  OBJECTIVE_LABEL,
} from "@/features/trafego/lib/catalog-labels";

const EXPIRES_IN_DAYS = 7;

/**
 * Dispara após o webhook marcar a compra como PAID. Envia o e-mail com o link
 * de ativação (`/trafego/ativar/<signupToken>`) que permite criar a conta e
 * cair direto no painel da campanha.
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
          status: true,
          platform: true,
          objective: true,
          adBudgetBrlCents: true,
          serviceFeeBrlCents: true,
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

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.BETTER_AUTH_URL ??
      "";
    const activationLink = `${baseUrl}/trafego/ativar/${pending.signupToken}`;

    await step.run("send-email", async () => {
      await resend.emails.send({
        from: "Nasaex <noreply@notifications.nasaex.com>",
        to: pending.email,
        subject: "Pagamento confirmado — ative sua campanha",
        react: reactTrafegoPurchaseConfirmationEmail({
          email: pending.email,
          planName: pending.plan?.name ?? "Campanha trafeGO",
          platformLabel: PLATFORM_SHORT_LABEL[pending.platform],
          objectiveLabel: OBJECTIVE_LABEL[pending.objective],
          adBudgetBrl: pending.adBudgetBrlCents / 100,
          serviceFeeBrl: pending.serviceFeeBrlCents / 100,
          totalBrl: pending.amountBrlCents / 100,
          durationDays: pending.plan?.durationDays ?? 30,
          activationLink,
          expiresInDays: EXPIRES_IN_DAYS,
        }),
      });
    });

    return { sent: true, pendingId };
  },
);
