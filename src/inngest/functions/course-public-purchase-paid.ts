import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import { reactCoursePurchaseConfirmationEmail } from "@/lib/email/course-purchase-confirmation";

export type CoursePublicPurchasePaidEvent = {
  data: {
    pendingId: string;
  };
};

/**
 * Job Inngest: dispara após o webhook do Stripe marcar uma compra pública de
 * curso (`PendingCoursePurchase`) como PAID. Envia o e-mail com o link de
 * resgate (`/resgatar/<signupToken>`) que permite ao comprador criar a conta
 * e cair direto no player do curso.
 *
 * Evento: `course/public-purchase.paid` — disparado em
 * `src/app/api/stripe/webhook/route.ts` após persistir status=PAID e
 * gerar `signupToken`.
 */
export const coursePublicPurchasePaid = inngest.createFunction(
  { id: "course-public-purchase-paid", retries: 3 },
  { event: "course/public-purchase.paid" },
  async ({ event, step }) => {
    const { pendingId } = event.data as CoursePublicPurchasePaidEvent["data"];

    // 1. Carrega pending + curso + plano + criador
    const pending = await step.run("load-pending", async () => {
      return prisma.pendingCoursePurchase.findUnique({
        where: { id: pendingId },
        select: {
          id: true,
          email: true,
          status: true,
          priceStars: true,
          amountBrlCents: true,
          signupToken: true,
          tokenExpiresAt: true,
          course: {
            select: {
              title: true,
              creatorOrg: { select: { name: true } },
            },
          },
          plan: { select: { name: true } },
        },
      });
    });

    if (!pending) {
      return { skipped: "pending_not_found", pendingId };
    }
    if (!pending.signupToken || !pending.tokenExpiresAt) {
      return { skipped: "missing_signup_token", pendingId };
    }
    if (pending.status !== "PAID") {
      return { skipped: "not_paid", pendingId, status: pending.status };
    }

    // 2. Calcula link de resgate + dias até expirar.
    // `step.run` retorna dados serializados, então `tokenExpiresAt` chega como
    // string ISO depois de deserializar — re-empacotamos em Date pra calcular.
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const redeemLink = `${base}/resgatar/${pending.signupToken}`;
    const expiresAtMs = new Date(pending.tokenExpiresAt).getTime();
    const expiresInDays = Math.max(
      1,
      Math.round((expiresAtMs - Date.now()) / (1000 * 60 * 60 * 24)),
    );

    // 3. Envia e-mail (Resend)
    const result = await step.run("send-email", async () => {
      const sendResult = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@nasaex.com",
        to: pending.email,
        subject: "Compra confirmada — crie sua conta para acessar o curso",
        react: reactCoursePurchaseConfirmationEmail({
          email: pending.email,
          courseTitle: pending.course.title,
          planName: pending.plan?.name ?? "Acesso ao curso",
          priceStars: pending.priceStars,
          amountBrl: pending.amountBrlCents / 100,
          creatorName: pending.course.creatorOrg.name,
          redeemLink,
          expiresInDays,
        }),
      });
      return { id: sendResult.data?.id ?? null, error: sendResult.error };
    });

    if (result.error) {
      throw new Error(
        `Resend send failed: ${result.error.message ?? "unknown"}`,
      );
    }

    return { sent: true, to: pending.email, resendId: result.id };
  },
);
