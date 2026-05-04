import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import {
  isAppMetricSource,
  type AppMetricSource,
} from "@/lib/insights/app-metrics";
import { z } from "zod";

interface MetricResult {
  value: number;
  previousValue: number;
  delta: number | null;
  trend: "up" | "down" | "flat";
  unit?: "count" | "percent" | "currency";
}

const dateRangeSchema = z
  .object({
    from: z.string().or(z.date()).optional(),
    to: z.string().or(z.date()).optional(),
  })
  .optional();

export const getAppMetric = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      appSlug: z.string(),
      metricKey: z.string(),
      dateRange: dateRangeSchema,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!isAppMetricSource(input.appSlug)) {
      throw errors.BAD_REQUEST({ message: "App slug inválido" });
    }

    const orgId = context.org.id;
    const now = new Date();
    const to = input.dateRange?.to ? new Date(input.dateRange.to) : now;
    const fromDefault = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const from = input.dateRange?.from
      ? new Date(input.dateRange.from)
      : fromDefault;

    const rangeMs = Math.max(to.getTime() - from.getTime(), 1);
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - rangeMs);

    const [value, previousValue, unit] = await resolveMetric(
      input.appSlug,
      input.metricKey,
      orgId,
      from,
      to,
      prevFrom,
      prevTo,
    );

    const delta =
      previousValue === 0
        ? value === 0
          ? 0
          : null
        : ((value - previousValue) / previousValue) * 100;

    const trend: MetricResult["trend"] =
      delta == null || Math.abs(delta) < 0.5
        ? "flat"
        : delta > 0
          ? "up"
          : "down";

    return {
      value,
      previousValue,
      delta,
      trend,
      unit,
    } satisfies MetricResult;
  });

async function resolveMetric(
  appSlug: AppMetricSource,
  metricKey: string,
  orgId: string,
  from: Date,
  to: Date,
  prevFrom: Date,
  prevTo: Date,
): Promise<[number, number, MetricResult["unit"] | undefined]> {
  switch (appSlug) {
    case "tracking":
      return resolveTracking(metricKey, orgId, from, to, prevFrom, prevTo);
    case "chat":
      return resolveChat(metricKey, orgId, from, to, prevFrom, prevTo);
    case "workspace":
      return resolveWorkspace(metricKey, orgId, from, to, prevFrom, prevTo);
    case "spacetime":
      return resolveSpacetime(metricKey, orgId, from, to, prevFrom, prevTo);
    case "nasa-route":
      return resolveNasaRoute(metricKey, orgId, from, to, prevFrom, prevTo);
    case "payment":
      return resolvePayment(metricKey, orgId, from, to, prevFrom, prevTo);
    case "forge":
      return resolveForge(metricKey, orgId, from, to, prevFrom, prevTo);
  }
}

async function resolveTracking(
  metricKey: string,
  orgId: string,
  from: Date,
  to: Date,
  prevFrom: Date,
  prevTo: Date,
): Promise<[number, number, MetricResult["unit"] | undefined]> {
  const trackings = await prisma.tracking.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  const trackingIds = trackings.map((t) => t.id);
  if (trackingIds.length === 0) return [0, 0, "count"];

  const baseWhere = { trackingId: { in: trackingIds } };

  if (metricKey === "leads.total") {
    const [a, b] = await Promise.all([
      prisma.lead.count({
        where: { ...baseWhere, createdAt: { gte: from, lte: to } },
      }),
      prisma.lead.count({
        where: { ...baseWhere, createdAt: { gte: prevFrom, lte: prevTo } },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "leads.won") {
    const [a, b] = await Promise.all([
      prisma.lead.count({
        where: {
          ...baseWhere,
          currentAction: "WON",
          closedAt: { gte: from, lte: to },
        },
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          currentAction: "WON",
          closedAt: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "leads.conversion-rate") {
    const [totalA, wonA, totalB, wonB] = await Promise.all([
      prisma.lead.count({
        where: { ...baseWhere, createdAt: { gte: from, lte: to } },
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          currentAction: "WON",
          closedAt: { gte: from, lte: to },
        },
      }),
      prisma.lead.count({
        where: { ...baseWhere, createdAt: { gte: prevFrom, lte: prevTo } },
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          currentAction: "WON",
          closedAt: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    const rateA = totalA === 0 ? 0 : (wonA / totalA) * 100;
    const rateB = totalB === 0 ? 0 : (wonB / totalB) * 100;
    return [Math.round(rateA * 10) / 10, Math.round(rateB * 10) / 10, "percent"];
  }

  return [0, 0, "count"];
}

async function resolveChat(
  metricKey: string,
  orgId: string,
  from: Date,
  to: Date,
  prevFrom: Date,
  prevTo: Date,
): Promise<[number, number, MetricResult["unit"] | undefined]> {
  const trackings = await prisma.tracking.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  const trackingIds = trackings.map((t) => t.id);
  if (trackingIds.length === 0) return [0, 0, "count"];

  const where = { trackingId: { in: trackingIds } };

  if (metricKey === "conversations.total") {
    const [a, b] = await Promise.all([
      prisma.conversation.count({
        where: { ...where, createdAt: { gte: from, lte: to } },
      }),
      prisma.conversation.count({
        where: { ...where, createdAt: { gte: prevFrom, lte: prevTo } },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "conversations.unread") {
    const [a, b] = await Promise.all([
      prisma.conversation.count({
        where: {
          ...where,
          isActive: true,
          messages: { some: { fromMe: false, seen: false } },
        },
      }),
      prisma.conversation.count({
        where: {
          ...where,
          isActive: true,
          messages: { some: { fromMe: false, seen: false } },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "messages.sent") {
    const [a, b] = await Promise.all([
      prisma.message.count({
        where: {
          fromMe: true,
          createdAt: { gte: from, lte: to },
          conversation: { trackingId: { in: trackingIds } },
        },
      }),
      prisma.message.count({
        where: {
          fromMe: true,
          createdAt: { gte: prevFrom, lte: prevTo },
          conversation: { trackingId: { in: trackingIds } },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  return [0, 0, "count"];
}

async function resolveWorkspace(
  metricKey: string,
  orgId: string,
  from: Date,
  to: Date,
  prevFrom: Date,
  prevTo: Date,
): Promise<[number, number, MetricResult["unit"] | undefined]> {
  if (metricKey === "actions.total") {
    const [a, b] = await Promise.all([
      prisma.action.count({
        where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
      }),
      prisma.action.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "actions.completed") {
    const [a, b] = await Promise.all([
      prisma.action.count({
        where: {
          organizationId: orgId,
          isDone: true,
          closedAt: { gte: from, lte: to },
        },
      }),
      prisma.action.count({
        where: {
          organizationId: orgId,
          isDone: true,
          closedAt: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "actions.overdue") {
    const now = new Date();
    const a = await prisma.action.count({
      where: {
        organizationId: orgId,
        isDone: false,
        dueDate: { lt: now },
      },
    });
    return [a, a, "count"];
  }

  return [0, 0, "count"];
}

async function resolveSpacetime(
  metricKey: string,
  orgId: string,
  from: Date,
  to: Date,
  prevFrom: Date,
  prevTo: Date,
): Promise<[number, number, MetricResult["unit"] | undefined]> {
  if (metricKey === "events.total") {
    const [a, b] = await Promise.all([
      prisma.action.count({
        where: {
          organizationId: orgId,
          isPublic: true,
          startDate: { gte: from, lte: to },
        },
      }),
      prisma.action.count({
        where: {
          organizationId: orgId,
          isPublic: true,
          startDate: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "events.upcoming") {
    const now = new Date();
    const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const a = await prisma.action.count({
      where: {
        organizationId: orgId,
        isPublic: true,
        startDate: { gte: now, lte: next30 },
      },
    });
    return [a, a, "count"];
  }

  return [0, 0, "count"];
}

async function resolveNasaRoute(
  metricKey: string,
  orgId: string,
  from: Date,
  to: Date,
  prevFrom: Date,
  prevTo: Date,
): Promise<[number, number, MetricResult["unit"] | undefined]> {
  if (metricKey === "courses.published") {
    const [a, b] = await Promise.all([
      prisma.nasaRouteCourse.count({
        where: {
          creatorOrgId: orgId,
          isPublished: true,
          publishedAt: { gte: from, lte: to },
        },
      }),
      prisma.nasaRouteCourse.count({
        where: {
          creatorOrgId: orgId,
          isPublished: true,
          publishedAt: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "lessons.completed") {
    const courses = await prisma.nasaRouteCourse.findMany({
      where: { creatorOrgId: orgId },
      select: { id: true },
    });
    const courseIds = courses.map((c) => c.id);
    if (courseIds.length === 0) return [0, 0, "count"];

    const [a, b] = await Promise.all([
      prisma.nasaRouteProgress.count({
        where: {
          courseId: { in: courseIds },
          completedAt: { gte: from, lte: to },
        },
      }),
      prisma.nasaRouteProgress.count({
        where: {
          courseId: { in: courseIds },
          completedAt: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "students.active") {
    const courses = await prisma.nasaRouteCourse.findMany({
      where: { creatorOrgId: orgId },
      select: { id: true },
    });
    const courseIds = courses.map((c) => c.id);
    if (courseIds.length === 0) return [0, 0, "count"];

    const [a, b] = await Promise.all([
      prisma.nasaRouteEnrollment.count({
        where: {
          courseId: { in: courseIds },
          status: "active",
          enrolledAt: { lte: to },
        },
      }),
      prisma.nasaRouteEnrollment.count({
        where: {
          courseId: { in: courseIds },
          status: "active",
          enrolledAt: { lte: prevTo },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  return [0, 0, "count"];
}

async function resolvePayment(
  metricKey: string,
  orgId: string,
  from: Date,
  to: Date,
  prevFrom: Date,
  prevTo: Date,
): Promise<[number, number, MetricResult["unit"] | undefined]> {
  if (metricKey === "charges.total") {
    const [a, b] = await Promise.all([
      prisma.paymentEntry.count({
        where: {
          organizationId: orgId,
          type: "RECEIVABLE",
          dueDate: { gte: from, lte: to },
        },
      }),
      prisma.paymentEntry.count({
        where: {
          organizationId: orgId,
          type: "RECEIVABLE",
          dueDate: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "charges.paid") {
    const [a, b] = await Promise.all([
      prisma.paymentEntry.count({
        where: {
          organizationId: orgId,
          type: "RECEIVABLE",
          status: "PAID",
          paidAt: { gte: from, lte: to },
        },
      }),
      prisma.paymentEntry.count({
        where: {
          organizationId: orgId,
          type: "RECEIVABLE",
          status: "PAID",
          paidAt: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "revenue.gross") {
    const [a, b] = await Promise.all([
      prisma.paymentEntry.aggregate({
        _sum: { paidAmount: true },
        where: {
          organizationId: orgId,
          type: "RECEIVABLE",
          status: "PAID",
          paidAt: { gte: from, lte: to },
        },
      }),
      prisma.paymentEntry.aggregate({
        _sum: { paidAmount: true },
        where: {
          organizationId: orgId,
          type: "RECEIVABLE",
          status: "PAID",
          paidAt: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    const va = (a._sum.paidAmount ?? 0) / 100;
    const vb = (b._sum.paidAmount ?? 0) / 100;
    return [va, vb, "currency"];
  }

  return [0, 0, "count"];
}

async function resolveForge(
  metricKey: string,
  orgId: string,
  from: Date,
  to: Date,
  prevFrom: Date,
  prevTo: Date,
): Promise<[number, number, MetricResult["unit"] | undefined]> {
  if (metricKey === "proposals.total") {
    const [a, b] = await Promise.all([
      prisma.forgeProposal.count({
        where: {
          organizationId: orgId,
          isTemplate: false,
          createdAt: { gte: from, lte: to },
        },
      }),
      prisma.forgeProposal.count({
        where: {
          organizationId: orgId,
          isTemplate: false,
          createdAt: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "proposals.paid") {
    const [a, b] = await Promise.all([
      prisma.forgeProposal.count({
        where: {
          organizationId: orgId,
          isTemplate: false,
          status: "PAGA",
          updatedAt: { gte: from, lte: to },
        },
      }),
      prisma.forgeProposal.count({
        where: {
          organizationId: orgId,
          isTemplate: false,
          status: "PAGA",
          updatedAt: { gte: prevFrom, lte: prevTo },
        },
      }),
    ]);
    return [a, b, "count"];
  }

  if (metricKey === "revenue.closed") {
    const [paidA, paidB] = await Promise.all([
      prisma.forgeProposal.findMany({
        where: {
          organizationId: orgId,
          isTemplate: false,
          status: "PAGA",
          updatedAt: { gte: from, lte: to },
        },
        select: { products: { select: { quantity: true, unitValue: true } } },
      }),
      prisma.forgeProposal.findMany({
        where: {
          organizationId: orgId,
          isTemplate: false,
          status: "PAGA",
          updatedAt: { gte: prevFrom, lte: prevTo },
        },
        select: { products: { select: { quantity: true, unitValue: true } } },
      }),
    ]);

    const sum = (rows: typeof paidA) =>
      rows.reduce((acc, p) => {
        const sub = p.products.reduce(
          (s, pp) => s + Number(pp.quantity) * Number(pp.unitValue),
          0,
        );
        return acc + sub;
      }, 0);

    return [sum(paidA), sum(paidB), "currency"];
  }

  return [0, 0, "count"];
}
