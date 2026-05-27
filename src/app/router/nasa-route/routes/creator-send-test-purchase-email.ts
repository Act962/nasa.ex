import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { resend } from "@/lib/email/resend";
import { requireCourseManager } from "../utils";
import {
  renderPurchaseEmail,
  type CourseEmailConfig,
  type PurchaseEmailContext,
} from "@/features/nasa-route/lib/purchase-email";

/**
 * Envia um e-mail de teste do template de pós-compra para o próprio criador.
 *
 * Aceita `purchaseEmailEnabled`, `purchaseEmailSubject` e
 * `purchaseEmailBodyJson` opcionais no input — quando informados, prevalecem
 * sobre o que está salvo no banco. Isso permite que o editor envie preview
 * do estado atual do form (sem precisar salvar antes).
 *
 * Os placeholders são resolvidos com dados fake (Aluno Teste, R$ 99,90 etc.).
 */
export const creatorSendTestPurchaseEmail = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      courseId: z.string().min(1),
      purchaseEmailEnabled: z.boolean().optional(),
      purchaseEmailSubject: z.string().max(200).optional().nullable(),
      purchaseEmailBodyJson: z.any().optional().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const userEmail = context.user.email;

    if (!userEmail) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Seu usuário não tem e-mail configurado.",
      });
    }

    await requireCourseManager(userId, input.courseId);

    const course = await prisma.nasaRouteCourse.findUnique({
      where: { id: input.courseId },
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
    });

    if (!course) {
      throw new ORPCError("NOT_FOUND", { message: "Curso não encontrado." });
    }

    const base =
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const firstLessonId = course.lessons[0]?.id;
    const accessUrl = firstLessonId
      ? `${base}/router/nasa-route/curso/${course.id}/aula/${firstLessonId}`
      : `${base}/router/nasa-route/meus-cursos`;

    const ctx: PurchaseEmailContext = {
      studentName: "Aluno Teste",
      courseTitle: course.title,
      creatorName: course.creatorUser?.name ?? course.creatorOrg.name,
      orgName: course.creatorOrg.name,
      planName: "Acesso completo",
      amountBrl: 99.9,
      accessUrl,
      certificateUrl: null,
    };

    const courseConfig: CourseEmailConfig = {
      purchaseEmailEnabled:
        input.purchaseEmailEnabled ?? course.purchaseEmailEnabled,
      purchaseEmailSubject:
        input.purchaseEmailSubject !== undefined
          ? input.purchaseEmailSubject
          : course.purchaseEmailSubject,
      purchaseEmailBodyJson:
        input.purchaseEmailBodyJson !== undefined
          ? input.purchaseEmailBodyJson
          : course.purchaseEmailBodyJson,
    };

    const rendered = renderPurchaseEmail(courseConfig, ctx);

    const fromName = ctx.orgName.replace(/[<>"]/g, "").slice(0, 64);
    const fromAddress =
      process.env.RESEND_FROM_EMAIL ?? "noreply@notifications.nasaex.com";

    const sendResult = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: userEmail,
      subject: rendered.subject,
      react: rendered.react,
    });

    if (sendResult.error) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `Falha ao enviar e-mail de teste: ${sendResult.error.message ?? "erro desconhecido"}`,
      });
    }

    return { sent: true, to: userEmail, resendId: sendResult.data?.id ?? null };
  });
