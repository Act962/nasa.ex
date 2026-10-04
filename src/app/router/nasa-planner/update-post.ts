import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { assertPlannerOrganizationAccess, assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import { approvePost, reopenPostAfterEdit, submitPostForApproval } from "@/features/nasa-planner/server/approval";

const slideSchema = z.object({
  id: z.string().optional(),
  order: z.number().default(0),
  imageKey: z.string().optional(),
  headline: z.string().optional(),
  subtext: z.string().optional(),
  overlayConfig: z.record(z.string(), z.any()).optional(),
});

// Mudar qualquer um destes depois de aprovado exige nova aprovação (spec 0058, RF-2).
const CONTENT_FIELDS = ["type", "title", "caption", "hashtags", "cta", "thumbnail"] as const;

export const updatePost = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      postId: z.string(),
      type: z.enum(["STATIC", "CAROUSEL", "REEL", "STORY"]).optional(),
      // Programar e publicar têm rotas próprias; aqui só dá para voltar a rascunho, enviar ou aprovar.
      status: z.enum(["IDEA", "DRAFT", "PENDING_APPROVAL", "APPROVED"]).optional(),
      title: z.string().optional(),
      caption: z.string().optional(),
      script: z.string().max(10_000).nullable().optional(),
      objective: z.string().max(200).nullable().optional(),
      pillarId: z.string().nullable().optional(),
      hashtags: z.array(z.string()).optional(),
      cta: z.string().optional(),
      targetNetworks: z.array(z.string()).optional(),
      thumbnail: z.string().optional(),
      scheduledAt: z.string().nullable().optional(),
      slides: z.array(slideSchema).optional(),
      isAd: z.boolean().optional(),
      clientOrgName: z.string().optional(),
      orgProjectId: z.string().nullable().optional(),
      targetIgAccountId: z.string().nullable().optional(),
      targetFbPageId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { postId, slides, scheduledAt, status, ...data } = input;
    const { post: currentPost } = await assertPostAccess(context.user.id, postId, "create");
    // O formulário manda tudo de novo ao salvar: só conta o que mudou de verdade.
    const currentSlideKeys = currentPost.slides.map((slide) => slide.imageKey ?? "").join("|");
    const hasSlidesChange = slides !== undefined && slides.map((slide) => slide.imageKey ?? "").join("|") !== currentSlideKeys;
    const hasContentChange =
      hasSlidesChange ||
      CONTENT_FIELDS.some((field) => data[field] !== undefined && JSON.stringify(data[field]) !== JSON.stringify(currentPost[field]));
    // Horário de post programado só muda por "reprogramar", que refaz o agendamento.
    const canTouchSchedule = currentPost.status !== "SCHEDULED" && currentPost.status !== "PUBLISHING";

    await prisma.$transaction(async (tx) => {
      await tx.nasaPlannerPost.update({
        where: { id: postId },
        data: {
          ...data,
          ...(status && (status === "IDEA" || status === "DRAFT") && { status }),
          ...(canTouchSchedule && (scheduledAt === null ? { scheduledAt: null } : scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {})),
        },
      });

      if (slides !== undefined) {
        await tx.nasaPlannerPostSlide.deleteMany({ where: { postId } });
        if (slides.length > 0) {
          await tx.nasaPlannerPostSlide.createMany({
            data: slides.map((slide, index) => ({
              postId,
              order: slide.order ?? index,
              imageKey: slide.imageKey,
              headline: slide.headline,
              subtext: slide.subtext,
              overlayConfig: slide.overlayConfig ?? {},
            })),
          });
        }
      }
    });

    if (hasContentChange) await reopenPostAfterEdit(postId, context.user.id);
    if (status === "PENDING_APPROVAL" && currentPost.status !== "PENDING_APPROVAL") await submitPostForApproval({ postId, actorId: context.user.id });
    if (status === "APPROVED") {
      await assertPlannerOrganizationAccess(context.user.id, currentPost.organizationId, "approve").catch(() => {
        throw new ORPCError("FORBIDDEN", { message: "Só quem aprova conteúdo neste cliente pode marcar como aprovado." });
      });
      await approvePost({ postId, actorId: context.user.id });
    }

    const post = await prisma.nasaPlannerPost.findUnique({
      where: { id: postId },
      include: { slides: { orderBy: { order: "asc" } } },
    });

    return { post };
  });
