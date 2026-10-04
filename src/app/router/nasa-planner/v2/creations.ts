import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { NasaPlannerPostSource, NasaPlannerPostStatus } from "@/generated/prisma/enums";
import { assertPlannerOrganizationAccess, assertPostAccess, ensureDefaultPlanner, resolvePlannerOrganizationIds } from "@/features/nasa-planner/server/cross-org";

/** Caixa de criações (spec 0065, RF-6/RF-7): rascunhos vindos de IA, para revisão humana. */

const CREATION_STATUSES = [NasaPlannerPostStatus.IDEA, NasaPlannerPostStatus.DRAFT, NasaPlannerPostStatus.CHANGES_REQUESTED, NasaPlannerPostStatus.PENDING_APPROVAL];
const CREATION_SOURCES = [NasaPlannerPostSource.MCP, NasaPlannerPostSource.ASTRO, NasaPlannerPostSource.WHATSAPP];

export const listCreations = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationIds: z.array(z.string()).optional() }))
  .handler(async ({ input, context }) => {
    const organizationIds = await resolvePlannerOrganizationIds(context.user.id, input.organizationIds);
    const posts = await prisma.nasaPlannerPost.findMany({
      where: {
        organizationId: { in: organizationIds },
        status: { in: CREATION_STATUSES },
        OR: [{ source: { in: CREATION_SOURCES } }, { sourceActorLabel: { not: null } }],
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        organizationId: true,
        title: true,
        type: true,
        status: true,
        source: true,
        sourceActorLabel: true,
        thumbnail: true,
        videoKey: true,
        scheduledAt: true,
        createdAt: true,
        slides: { orderBy: { order: "asc" }, take: 1, select: { imageKey: true } },
      },
    });
    return { creations: posts };
  });

export const discardCreation = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    const { post } = await assertPostAccess(context.user.id, input.postId, "create");
    if (post.status === NasaPlannerPostStatus.PUBLISHED || post.status === NasaPlannerPostStatus.SCHEDULED) {
      throw new ORPCError("BAD_REQUEST", { message: "Post programado ou publicado não pode ser descartado aqui." });
    }
    await prisma.nasaPlannerPost.delete({ where: { id: input.postId } });
    return { ok: true as const };
  });

/** Criação de outra IA trazida por upload: o arquivo já subiu; aqui vira rascunho com a origem marcada. */
export const importCreation = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      organizationId: z.string(),
      format: z.enum(["STATIC", "CAROUSEL", "REEL", "STORY"]),
      originLabel: z.string().trim().min(2).max(60),
      mediaKey: z.string().min(1),
      isVideo: z.boolean(),
      title: z.string().trim().max(200).optional(),
      caption: z.string().max(2200).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "create");
    const plannerId = await ensureDefaultPlanner(input.organizationId);
    const igAccount = await prisma.metaPublishAccount.findFirst({ where: { organizationId: input.organizationId, kind: "IG_BUSINESS", status: "ACTIVE" }, select: { igUserId: true } });
    const post = await prisma.nasaPlannerPost.create({
      data: {
        organizationId: input.organizationId,
        plannerId,
        createdById: context.user.id,
        type: input.format,
        status: NasaPlannerPostStatus.DRAFT,
        title: input.title || `Criação do ${input.originLabel}`,
        caption: input.caption,
        hashtags: [],
        targetNetworks: ["INSTAGRAM"],
        targetIgAccountId: igAccount?.igUserId ?? null,
        source: NasaPlannerPostSource.WEB,
        sourceActorLabel: input.originLabel,
        ...(input.isVideo ? { videoKey: input.mediaKey } : input.format === "CAROUSEL" ? {} : { thumbnail: input.mediaKey }),
        ...(input.format === "CAROUSEL" && !input.isVideo && { slides: { create: [{ order: 1, imageKey: input.mediaKey }] } }),
      },
      select: { id: true },
    });
    return { postId: post.id };
  });
