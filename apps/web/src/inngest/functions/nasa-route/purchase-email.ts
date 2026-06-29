import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import {
  renderPurchaseEmail,
  type CourseEmailConfig,
  type PurchaseEmailContext,
} from "@/features/nasa-route/lib/purchase-email";

export type NasaRoutePurchaseCompletedEvent = {
  data: {
    enrollmentId: string;
  };
};

/**
 * Job Inngest: envia o e-mail de pós-compra ao aluno após qualquer matrícula
 * em curso da NASA Route — compra paga (Stripe), resgate público pós-signup
 * ou matrícula gratuita (`isFree` / free-access).
 *
 * Quando o criador customiza o e-mail (`course.purchaseEmailEnabled=true`),
 * renderiza o corpo TipTap JSON com placeholders resolvidos. Caso contrário,
 * usa o template default dinâmico assinado pela org.
 *
 * Evento: `nasa-route/purchase.completed` — disparado por
 * `triggerPurchaseEmail()` em `src/features/nasa-route/lib/purchase-email.ts`.
 */
export const nasaRoutePurchaseEmail = inngest.createFunction(
  { id: "nasa-route-purchase-email", retries: 3 },
  { event: "nasa-route/purchase.completed" },
  async ({ event, step }) => {
    const { enrollmentId } =
      event.data as NasaRoutePurchaseCompletedEvent["data"];

    const enrollment = await step.run("load-enrollment", async () => {
      return prisma.nasaRouteEnrollment.findUnique({
        where: { id: enrollmentId },
        select: {
          id: true,
          paidBrlCents: true,
          user: { select: { name: true, email: true } },
          plan: { select: { name: true } },
          course: {
            select: {
              id: true,
              title: true,
              purchaseEmailEnabled: true,
              purchaseEmailSubject: true,
              purchaseEmailBodyJson: true,
              creatorUser: { select: { name: true } },
              creatorOrg: { select: { name: true } },
              lessons: {
                select: { id: true },
                orderBy: { order: "asc" },
                take: 1,
              },
            },
          },
        },
      });
    });

    if (!enrollment) {
      return { skipped: "enrollment_not_found", enrollmentId };
    }
    if (!enrollment.user.email) {
      return { skipped: "user_missing_email", enrollmentId };
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const firstLessonId = enrollment.course.lessons[0]?.id;
    const accessUrl = firstLessonId
      ? `${base}/router/nasa-route/curso/${enrollment.course.id}/aula/${firstLessonId}`
      : `${base}/router/nasa-route/meus-cursos`;

    const ctx: PurchaseEmailContext = {
      studentName: enrollment.user.name ?? "aluno",
      courseTitle: enrollment.course.title,
      creatorName:
        enrollment.course.creatorUser?.name ??
        enrollment.course.creatorOrg.name,
      orgName: enrollment.course.creatorOrg.name,
      planName: enrollment.plan?.name ?? null,
      amountBrl:
        enrollment.paidBrlCents != null ? enrollment.paidBrlCents / 100 : null,
      accessUrl,
      certificateUrl: null,
    };

    const courseConfig: CourseEmailConfig = {
      purchaseEmailEnabled: enrollment.course.purchaseEmailEnabled,
      purchaseEmailSubject: enrollment.course.purchaseEmailSubject,
      purchaseEmailBodyJson: enrollment.course.purchaseEmailBodyJson,
    };

    const rendered = renderPurchaseEmail(courseConfig, ctx);

    const result = await step.run("send-email", async () => {
      const fromName = ctx.orgName.replace(/[<>"]/g, "").slice(0, 64);
      const fromAddress =
        process.env.RESEND_FROM_EMAIL ?? "noreply@notifications.nasaex.com";
      const sendResult = await resend.emails.send({
        from: `${fromName} <${fromAddress}>`,
        to: enrollment.user.email!,
        subject: rendered.subject,
        react: rendered.react,
      });
      return { id: sendResult.data?.id ?? null, error: sendResult.error };
    });

    if (result.error) {
      throw new Error(
        `Resend send failed: ${result.error.message ?? "unknown"}`,
      );
    }

    return { sent: true, to: enrollment.user.email, resendId: result.id };
  },
);
