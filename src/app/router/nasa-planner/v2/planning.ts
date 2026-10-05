import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { NasaPlannerPostSource, NasaPlannerPostStatus, NasaPlannerPostType } from "@/generated/prisma/enums";
import {
  assertPlannerOrganizationAccess,
  ensureDefaultPlanner,
  resolvePlannerOrganizationIds,
} from "@/features/nasa-planner/server/cross-org";

/** Roteiro e planejamento multi-cliente (spec 0058): criar post para qualquer cliente, metas, horários e pilares. */

export const createClientPost = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      organizationId: z.string(),
      plannerId: z.string().optional(),
      type: z.enum(NasaPlannerPostType).default(NasaPlannerPostType.STATIC),
      status: z.enum([NasaPlannerPostStatus.IDEA, NasaPlannerPostStatus.DRAFT]).default(NasaPlannerPostStatus.DRAFT),
      title: z.string().max(200).optional(),
      script: z.string().max(10_000).optional(),
      objective: z.string().max(200).optional(),
      cta: z.string().max(300).optional(),
      caption: z.string().max(2200).optional(),
      hashtags: z.array(z.string().max(100)).max(30).optional(),
      pillarId: z.string().optional(),
      momentKey: z.string().max(60).optional(),
      intendedAt: z.coerce.date().optional(),
      targetNetworks: z.array(z.enum(["INSTAGRAM", "FACEBOOK"])).default(["INSTAGRAM"]),
      targetIgAccountId: z.string().optional(),
      targetFbPageId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "create");
    const plannerId = input.plannerId
      ? (await prisma.nasaPlanner.findFirstOrThrow({ where: { id: input.plannerId, organizationId: input.organizationId }, select: { id: true } })).id
      : await ensureDefaultPlanner(input.organizationId);
    const post = await prisma.nasaPlannerPost.create({
      data: {
        organizationId: input.organizationId,
        plannerId,
        createdById: context.user.id,
        type: input.type,
        status: input.status,
        title: input.title,
        script: input.script,
        objective: input.objective,
        cta: input.cta,
        caption: input.caption,
        pillarId: input.pillarId,
        momentKey: input.momentKey,
        // Horário pretendido fica como sugestão; só vira programação real em `schedule`.
        scheduledAt: input.intendedAt,
        targetNetworks: input.targetNetworks,
        targetIgAccountId: input.targetIgAccountId,
        targetFbPageId: input.targetFbPageId,
        hashtags: (input.hashtags ?? []).map((hashtag) => hashtag.replace(/^#/, "")),
        source: NasaPlannerPostSource.WEB,
      },
    });
    return { post };
  });

export const getGoals = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationIds: z.array(z.string()).max(50).optional() }).optional())
  .handler(async ({ input, context }) => {
    const organizationIds = await resolvePlannerOrganizationIds(context.user.id, input?.organizationIds);
    const goals = await prisma.nasaPlannerCadenceGoal.findMany({ where: { organizationId: { in: organizationIds } } });
    return { goals };
  });

export const setGoal = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string(), postType: z.enum(NasaPlannerPostType), perWeek: z.number().int().min(0).max(70) }))
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "schedule");
    if (input.perWeek === 0) {
      await prisma.nasaPlannerCadenceGoal.deleteMany({ where: { organizationId: input.organizationId, postType: input.postType } });
      return { goal: null };
    }
    const goal = await prisma.nasaPlannerCadenceGoal.upsert({
      where: { organizationId_postType: { organizationId: input.organizationId, postType: input.postType } },
      update: { perWeek: input.perWeek },
      create: input,
    });
    return { goal };
  });

export const upsertSlot = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      organizationId: z.string(),
      weekday: z.number().int().min(0).max(6),
      minuteOfDay: z.number().int().min(0).max(1439),
      postTypes: z.array(z.enum(NasaPlannerPostType)).default([]),
      isActive: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "schedule");
    const { id: slotId, ...slotData } = input;
    const slot = slotId
      ? await prisma.nasaPlannerPublishSlot.update({ where: { id: slotId, organizationId: input.organizationId }, data: slotData })
      : await prisma.nasaPlannerPublishSlot.create({ data: slotData });
    return { slot };
  });

export const deleteSlot = base
  .use(requiredAuthMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const slot = await prisma.nasaPlannerPublishSlot.findUniqueOrThrow({ where: { id: input.id }, select: { organizationId: true } });
    await assertPlannerOrganizationAccess(context.user.id, slot.organizationId, "schedule");
    await prisma.nasaPlannerPublishSlot.delete({ where: { id: input.id } });
    return { ok: true };
  });

export const listPillars = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationIds: z.array(z.string()).max(50).optional() }).optional())
  .handler(async ({ input, context }) => {
    const organizationIds = await resolvePlannerOrganizationIds(context.user.id, input?.organizationIds);
    const pillars = await prisma.nasaPlannerContentPillar.findMany({
      where: { organizationId: { in: organizationIds } },
      orderBy: [{ organizationId: "asc" }, { order: "asc" }],
    });
    return { pillars };
  });

export const upsertPillar = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      organizationId: z.string(),
      name: z.string().trim().min(1).max(60),
      colorToken: z.enum(["info", "success", "warning", "destructive", "foreground"]).default("info"),
      description: z.string().max(500).optional(),
      targetSharePct: z.number().int().min(0).max(100).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "schedule");
    const { id: pillarId, ...pillarData } = input;
    if (pillarId) {
      const pillar = await prisma.nasaPlannerContentPillar.update({ where: { id: pillarId, organizationId: input.organizationId }, data: pillarData });
      return { pillar };
    }
    const plannerId = await ensureDefaultPlanner(input.organizationId);
    const pillarCount = await prisma.nasaPlannerContentPillar.count({ where: { organizationId: input.organizationId } });
    const pillar = await prisma.nasaPlannerContentPillar.create({ data: { ...pillarData, plannerId, order: pillarCount } });
    return { pillar };
  });

export const deletePillar = base
  .use(requiredAuthMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const pillar = await prisma.nasaPlannerContentPillar.findUniqueOrThrow({ where: { id: input.id }, select: { organizationId: true } });
    await assertPlannerOrganizationAccess(context.user.id, pillar.organizationId, "schedule");
    await prisma.nasaPlannerContentPillar.delete({ where: { id: input.id } });
    return { ok: true };
  });

export const setApprovalRequired = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string(), requiresApproval: z.boolean() }))
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "approve");
    const plannerId = await ensureDefaultPlanner(input.organizationId);
    await prisma.nasaPlanner.updateMany({ where: { organizationId: input.organizationId }, data: { requiresApproval: input.requiresApproval } });
    return { plannerId, requiresApproval: input.requiresApproval };
  });

export const listWeekdayThemes = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationIds: z.array(z.string()).max(50).optional() }).optional())
  .handler(async ({ input, context }) => {
    const organizationIds = await resolvePlannerOrganizationIds(context.user.id, input?.organizationIds);
    const themes = await prisma.nasaPlannerWeekdayTheme.findMany({
      where: { organizationId: { in: organizationIds } },
      select: { organizationId: true, weekday: true, theme: true },
    });
    return { themes };
  });

export const setWeekdayTheme = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string(), weekday: z.number().int().min(0).max(6), theme: z.string().trim().max(80) }))
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "create");
    const where = { organizationId_weekday: { organizationId: input.organizationId, weekday: input.weekday } };
    if (!input.theme) {
      await prisma.nasaPlannerWeekdayTheme.deleteMany({ where: { organizationId: input.organizationId, weekday: input.weekday } });
      return { theme: null };
    }
    const theme = await prisma.nasaPlannerWeekdayTheme.upsert({ where, update: { theme: input.theme }, create: input });
    return { theme };
  });
