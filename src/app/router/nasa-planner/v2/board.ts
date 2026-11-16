import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { NasaPlannerPostSource, NasaPlannerPostStatus, NasaPlannerPostType } from "@/generated/prisma/enums";
import { resolvePlannerOrganizationIds } from "@/features/nasa-planner/server/cross-org";

/** Kanban por status e Dashboard geral do Planner (abas do topo, multi-cliente). */

const DAY_MS = 24 * 60 * 60 * 1000;
const COLUMN_PAGE_SIZE = 30;
const PUBLISHED_WINDOW_DAYS = 30;
const AI_SOURCES = [NasaPlannerPostSource.MCP, NasaPlannerPostSource.ASTRO, NasaPlannerPostSource.WHATSAPP];

export const BOARD_COLUMNS = [
  { key: "draft", statuses: [NasaPlannerPostStatus.IDEA, NasaPlannerPostStatus.DRAFT] },
  { key: "changes", statuses: [NasaPlannerPostStatus.CHANGES_REQUESTED] },
  { key: "approval", statuses: [NasaPlannerPostStatus.PENDING_APPROVAL] },
  { key: "approved", statuses: [NasaPlannerPostStatus.APPROVED] },
  { key: "scheduled", statuses: [NasaPlannerPostStatus.SCHEDULED, NasaPlannerPostStatus.PUBLISHING] },
  { key: "published", statuses: [NasaPlannerPostStatus.PUBLISHED] },
  { key: "failed", statuses: [NasaPlannerPostStatus.FAILED] },
] as const;

const aiOriginWhere: Prisma.NasaPlannerPostWhereInput = { OR: [{ source: { in: AI_SOURCES } }, { sourceActorLabel: { not: null } }] };
const humanOriginWhere: Prisma.NasaPlannerPostWhereInput = { source: { notIn: AI_SOURCES }, sourceActorLabel: null };

const boardPostSelect = {
  id: true,
  organizationId: true,
  type: true,
  status: true,
  title: true,
  thumbnail: true,
  videoKey: true,
  scheduledAt: true,
  publishedAt: true,
  publishError: true,
  source: true,
  sourceActorLabel: true,
  publishGroupId: true,
  updatedAt: true,
  slides: { orderBy: { order: "asc" }, take: 1, select: { imageKey: true } },
  _count: { select: { reviews: true } },
} as const;

const boardFiltersSchema = z.object({
  organizationIds: z.array(z.string()).max(50).optional(),
  types: z.array(z.enum(NasaPlannerPostType)).optional(),
  origin: z.enum(["all", "ai", "human"]).default("all"),
});

type BoardColumnKey = (typeof BOARD_COLUMNS)[number]["key"];
const BOARD_COLUMN_KEYS = BOARD_COLUMNS.map((column) => column.key) as [BoardColumnKey, ...BoardColumnKey[]];

async function buildBaseWhere(userId: string, filters: z.infer<typeof boardFiltersSchema>): Promise<Prisma.NasaPlannerPostWhereInput> {
  const organizationIds = await resolvePlannerOrganizationIds(userId, filters.organizationIds);
  return {
    organizationId: { in: organizationIds },
    ...(filters.types?.length && { type: { in: filters.types } }),
    ...(filters.origin === "ai" && aiOriginWhere),
    ...(filters.origin === "human" && humanOriginWhere),
  };
}

/** `id` desempata a ordem: sem ele o cursor pularia ou repetiria posts com a mesma data. */
function buildColumnQuery(columnKey: BoardColumnKey, baseWhere: Prisma.NasaPlannerPostWhereInput) {
  const column = BOARD_COLUMNS.find((boardColumn) => boardColumn.key === columnKey)!;
  const publishedSince = new Date(Date.now() - PUBLISHED_WINDOW_DAYS * DAY_MS);
  const where: Prisma.NasaPlannerPostWhereInput = {
    ...baseWhere,
    status: { in: [...column.statuses] },
    ...(columnKey === "published" && { publishedAt: { gte: publishedSince } }),
  };
  const orderBy: Prisma.NasaPlannerPostOrderByWithRelationInput[] =
    columnKey === "scheduled" ? [{ scheduledAt: "asc" }, { id: "asc" }] : columnKey === "published" ? [{ publishedAt: "desc" }, { id: "desc" }] : [{ updatedAt: "desc" }, { id: "desc" }];
  return { where, orderBy };
}

async function findColumnPage(columnKey: BoardColumnKey, baseWhere: Prisma.NasaPlannerPostWhereInput, cursor?: string) {
  const { where, orderBy } = buildColumnQuery(columnKey, baseWhere);
  const posts = await prisma.nasaPlannerPost.findMany({
    where,
    select: boardPostSelect,
    orderBy,
    take: COLUMN_PAGE_SIZE + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });
  const hasMore = posts.length > COLUMN_PAGE_SIZE;
  const pagePosts = hasMore ? posts.slice(0, COLUMN_PAGE_SIZE) : posts;
  return { posts: pagePosts, nextCursor: hasMore ? pagePosts[pagePosts.length - 1].id : null };
}

export const listBoardPosts = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/nasa-planner/board", summary: "Posts do Planner em colunas por status (Kanban)" })
  .input(boardFiltersSchema)
  .handler(async ({ input, context }) => {
    const baseWhere = await buildBaseWhere(context.user.id, input);
    const columns = await Promise.all(
      BOARD_COLUMNS.map(async (column) => {
        const [page, total] = await Promise.all([findColumnPage(column.key, baseWhere), prisma.nasaPlannerPost.count({ where: buildColumnQuery(column.key, baseWhere).where })]);
        return { key: column.key, total, ...page };
      }),
    );
    return { columns };
  });

/** Próximas páginas de uma coluna do Kanban, ao rolar até o fim dela. */
export const listBoardColumnPage = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/nasa-planner/board/column", summary: "Mais posts de uma coluna do Kanban do Planner" })
  .input(boardFiltersSchema.extend({ columnKey: z.enum(BOARD_COLUMN_KEYS), cursor: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const baseWhere = await buildBaseWhere(context.user.id, input);
    return findColumnPage(input.columnKey, baseWhere, input.cursor);
  });

export const getPlannerDashboard = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/nasa-planner/dashboard", summary: "Números gerais do Planner dos clientes escolhidos" })
  .input(z.object({ organizationIds: z.array(z.string()).max(50).optional() }))
  .handler(async ({ input, context }) => {
    const organizationIds = await resolvePlannerOrganizationIds(context.user.id, input.organizationIds);
    const now = new Date();
    const [statusCounts, scheduledNextWeek, aiAwaitingReview, needsAttention, recentReviews, recentCreations] = await Promise.all([
      prisma.nasaPlannerPost.groupBy({ by: ["status"], where: { organizationId: { in: organizationIds } }, _count: { _all: true } }),
      prisma.nasaPlannerPost.count({
        where: { organizationId: { in: organizationIds }, status: NasaPlannerPostStatus.SCHEDULED, scheduledAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY_MS) } },
      }),
      prisma.nasaPlannerPost.count({
        where: { organizationId: { in: organizationIds }, status: { in: [NasaPlannerPostStatus.DRAFT, NasaPlannerPostStatus.PENDING_APPROVAL] }, ...aiOriginWhere },
      }),
      prisma.nasaPlannerPost.findMany({
        where: { organizationId: { in: organizationIds }, status: { in: [NasaPlannerPostStatus.PENDING_APPROVAL, NasaPlannerPostStatus.CHANGES_REQUESTED, NasaPlannerPostStatus.FAILED] } },
        select: { id: true, organizationId: true, type: true, status: true, title: true, source: true, sourceActorLabel: true, publishError: true },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.nasaPlannerPostReview.findMany({
        where: { organizationId: { in: organizationIds } },
        select: { id: true, kind: true, authorId: true, createdAt: true, post: { select: { id: true, title: true, type: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.nasaPlannerPost.findMany({
        where: { organizationId: { in: organizationIds }, ...aiOriginWhere },
        select: { id: true, title: true, type: true, source: true, sourceActorLabel: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
    ]);
    const authorIds = [...new Set(recentReviews.map((review) => review.authorId).filter((authorId): authorId is string => Boolean(authorId)))];
    const authors = authorIds.length ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } }) : [];
    const authorNameById = new Map(authors.map((author) => [author.id, author.name]));

    const activities = [
      ...recentReviews.map((review) => ({
        id: `review:${review.id}`,
        postId: review.post.id,
        postTitle: review.post.title,
        actorName: review.authorId ? (authorNameById.get(review.authorId) ?? "Alguém") : "Sistema",
        kind: review.kind as string,
        at: review.createdAt,
      })),
      ...recentCreations.map((creation) => ({
        id: `creation:${creation.id}`,
        postId: creation.id,
        postTitle: creation.title,
        actorName: creation.sourceActorLabel ?? (creation.source === "WHATSAPP" ? "Astro · WhatsApp" : "Astro"),
        kind: "CREATED_BY_AI",
        at: creation.createdAt,
      })),
    ]
      .sort((first, second) => second.at.getTime() - first.at.getTime())
      .slice(0, 8);

    return {
      statusCounts: Object.fromEntries(statusCounts.map((count) => [count.status, count._count._all])) as Partial<Record<NasaPlannerPostStatus, number>>,
      scheduledNextWeek,
      aiAwaitingReview,
      needsAttention,
      activities,
    };
  });
