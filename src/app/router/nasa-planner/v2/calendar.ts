import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { NasaPlannerPostStatus, NasaPlannerPostType } from "@/generated/prisma/enums";
import { listPlannerOrganizations, resolvePlannerOrganizationIds } from "@/features/nasa-planner/server/cross-org";
import { listPublishAccounts } from "@/features/nasa-planner/server/publishing/publish-accounts";
import { listOfficialSendingNumbers } from "@/features/nasa-planner/server/whatsapp-broadcast";
import { listMomentsBetween } from "@/features/nasa-planner/lib/moments-br";
import { DEFAULT_SLOT_RULES, expandSlotRules } from "@/features/nasa-planner/lib/publish-slots";

/** Calendário multi-cliente do Planner (spec 0058): clientes, posts do período, rascunhos, horários e momentos. */

const MAX_RANGE_DAYS = 62;
const DAY_MS = 24 * 60 * 60 * 1000;
const DRAFTS_PAGE_SIZE = 40;

const rangeInput = z.object({
  organizationIds: z.array(z.string()).max(50).optional(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

function assertRange(from: Date, to: Date) {
  if (to <= from || to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw new ORPCError("BAD_REQUEST", { message: `Escolha um período de até ${MAX_RANGE_DAYS} dias.` });
  }
}

const calendarPostSelect = {
  id: true,
  organizationId: true,
  plannerId: true,
  type: true,
  status: true,
  title: true,
  objective: true,
  cta: true,
  thumbnail: true,
  videoKey: true,
  scheduledAt: true,
  publishedAt: true,
  targetNetworks: true,
  targetIgAccountId: true,
  targetFbPageId: true,
  pillarId: true,
  publishError: true,
  externalIgPermalink: true,
  source: true,
  sourceActorLabel: true,
  commentsAutomationId: true,
  updatedAt: true,
} as const;

export const listPlannerClients = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/nasa-planner/clients", summary: "Clientes (orgs) do Planner do usuário" })
  .handler(async ({ context }) => {
    const organizations = await listPlannerOrganizations(context.user.id);
    const organizationIds = organizations.map((organization) => organization.id);
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);
    const [accounts, sendingNumbers, statusCounts, planners] = await Promise.all([
      listPublishAccounts(organizationIds),
      listOfficialSendingNumbers(organizationIds),
      prisma.nasaPlannerPost.groupBy({
        by: ["organizationId", "status"],
        where: { organizationId: { in: organizationIds }, OR: [{ status: { not: NasaPlannerPostStatus.PUBLISHED } }, { publishedAt: { gte: weekAgo } }] },
        _count: { _all: true },
      }),
      prisma.nasaPlanner.findMany({ where: { organizationId: { in: organizationIds } }, orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true } }),
    ]);
    return {
      clients: organizations.map((organization) => {
        const countOf = (status: NasaPlannerPostStatus) =>
          statusCounts.find((count) => count.organizationId === organization.id && count.status === status)?._count._all ?? 0;
        return {
          id: organization.id,
          name: organization.name,
          logo: organization.logo,
          // Planner mais antigo = o padrão (mesma regra de ensureDefaultPlanner); Campanhas e Mapas Mentais moram nele.
          defaultPlannerId: planners.find((planner) => planner.organizationId === organization.id)?.id ?? null,
          permissions: {
            canCreate: organization.permissions.canCreate,
            canApprove: organization.permissions.canApprove,
            canSchedule: organization.permissions.canEdit || organization.permissions.canApprove,
          },
          accounts: accounts.filter((account) => account.organizationId === organization.id),
          whatsappNumbers: sendingNumbers.filter((number) => number.organizationId === organization.id),
          counts: {
            drafts: countOf(NasaPlannerPostStatus.IDEA) + countOf(NasaPlannerPostStatus.DRAFT),
            changesRequested: countOf(NasaPlannerPostStatus.CHANGES_REQUESTED),
            pendingApproval: countOf(NasaPlannerPostStatus.PENDING_APPROVAL),
            scheduled: countOf(NasaPlannerPostStatus.SCHEDULED),
            failed: countOf(NasaPlannerPostStatus.FAILED),
          },
        };
      }),
    };
  });

export const listCalendarPosts = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/nasa-planner/calendar", summary: "Posts do período no calendário multi-cliente" })
  .input(
    rangeInput.extend({
      types: z.array(z.enum(NasaPlannerPostType)).optional(),
      statuses: z.array(z.enum(NasaPlannerPostStatus)).optional(),
      pillarIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    assertRange(input.from, input.to);
    const organizationIds = await resolvePlannerOrganizationIds(context.user.id, input.organizationIds);
    const posts = await prisma.nasaPlannerPost.findMany({
      where: {
        organizationId: { in: organizationIds },
        ...(input.types?.length && { type: { in: input.types } }),
        ...(input.statuses?.length && { status: { in: input.statuses } }),
        ...(input.pillarIds?.length && { pillarId: { in: input.pillarIds } }),
        OR: [
          { scheduledAt: { gte: input.from, lt: input.to } },
          { scheduledAt: null, publishedAt: { gte: input.from, lt: input.to } },
        ],
      },
      select: calendarPostSelect,
      orderBy: { scheduledAt: "asc" },
      take: 500,
    });
    return { posts };
  });

export const listCalendarDrafts = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/nasa-planner/drafts", summary: "Rascunhos e conteúdos com ajustes pedidos" })
  .input(
    z.object({
      organizationIds: z.array(z.string()).max(50).optional(),
      queue: z.enum(["drafts", "approval"]).default("drafts"),
      cursor: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationIds = await resolvePlannerOrganizationIds(context.user.id, input.organizationIds);
    const statuses =
      input.queue === "approval"
        ? [NasaPlannerPostStatus.PENDING_APPROVAL]
        : [NasaPlannerPostStatus.IDEA, NasaPlannerPostStatus.DRAFT, NasaPlannerPostStatus.CHANGES_REQUESTED, NasaPlannerPostStatus.APPROVED];
    const posts = await prisma.nasaPlannerPost.findMany({
      where: { organizationId: { in: organizationIds }, status: { in: statuses } },
      select: { ...calendarPostSelect, script: true, momentKey: true, submittedAt: true, _count: { select: { reviews: true } } },
      orderBy: { updatedAt: "desc" },
      take: DRAFTS_PAGE_SIZE + 1,
      ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
    });
    const hasMore = posts.length > DRAFTS_PAGE_SIZE;
    return { posts: posts.slice(0, DRAFTS_PAGE_SIZE), nextCursor: hasMore ? posts[DRAFTS_PAGE_SIZE - 1].id : null };
  });

export const listCalendarSlots = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/nasa-planner/slots", summary: "Horários sugeridos livres no período" })
  .input(rangeInput)
  .handler(async ({ input, context }) => {
    assertRange(input.from, input.to);
    const organizationIds = await resolvePlannerOrganizationIds(context.user.id, input.organizationIds);
    const [customSlots, takenPosts] = await Promise.all([
      prisma.nasaPlannerPublishSlot.findMany({ where: { organizationId: { in: organizationIds }, isActive: true } }),
      prisma.nasaPlannerPost.findMany({
        where: { organizationId: { in: organizationIds }, scheduledAt: { gte: input.from, lt: input.to } },
        select: { scheduledAt: true },
      }),
    ]);
    const rules = customSlots.length
      ? customSlots.map((slot) => ({ weekday: slot.weekday, minuteOfDay: slot.minuteOfDay, postTypes: slot.postTypes, label: "Horário da sua cadência" }))
      : DEFAULT_SLOT_RULES;
    const takenHours = new Set(takenPosts.map((post) => Math.floor((post.scheduledAt?.getTime() ?? 0) / (60 * 60 * 1000))));
    const now = Date.now();
    const slots = expandSlotRules(rules, input.from, input.to).filter(
      (slot) => slot.startsAt.getTime() > now && !takenHours.has(Math.floor(slot.startsAt.getTime() / (60 * 60 * 1000))),
    );
    return { slots, source: customSlots.length ? ("MANUAL" as const) : ("DEFAULT" as const) };
  });

export const listCalendarMoments = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/nasa-planner/moments", summary: "Datas comemorativas e eventos de campanha" })
  .input(rangeInput)
  .handler(async ({ input, context }) => {
    const organizationIds = await resolvePlannerOrganizationIds(context.user.id, input.organizationIds);
    const campaignEvents = await prisma.nasaCampaignEvent.findMany({
      where: { scheduledAt: { gte: input.from, lt: input.to }, campaignPlanner: { organizationId: { in: organizationIds } } },
      select: { id: true, title: true, scheduledAt: true, campaignPlanner: { select: { organizationId: true, title: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 100,
    });
    return {
      moments: listMomentsBetween(input.from, input.to),
      campaignEvents: campaignEvents.map((campaignEvent) => ({
        id: campaignEvent.id,
        title: campaignEvent.title,
        date: campaignEvent.scheduledAt,
        organizationId: campaignEvent.campaignPlanner.organizationId,
        campaignTitle: campaignEvent.campaignPlanner.title,
      })),
    };
  });
