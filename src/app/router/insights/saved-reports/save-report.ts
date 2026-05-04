import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";

export const saveReport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(1).max(120),
      description: z.string().max(500).optional(),
      filters: z.any(),
      modules: z.array(z.string()),
      snapshot: z.any(),
      aiNarrative: z.string().optional(),
      generateShareToken: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context }) => {
    const shareToken = input.generateShareToken
      ? randomUUID().replace(/-/g, "")
      : null;

    const report = await prisma.savedInsightReport.create({
      data: {
        organizationId: context.org.id,
        userId: context.user.id,
        name: input.name,
        description: input.description ?? null,
        filters: (input.filters ?? {}) as Prisma.InputJsonValue,
        modules: (input.modules ?? []) as Prisma.InputJsonValue,
        snapshot: (input.snapshot ?? {}) as Prisma.InputJsonValue,
        aiNarrative: input.aiNarrative ?? null,
        shareToken,
      },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "insights",
      subAppSlug: "insights-reports",
      featureKey: "insights.report.saved",
      action: "insights.report.saved",
      actionLabel: `Salvou o relatório "${report.name}"`,
      resource: report.name,
      resourceId: report.id,
      metadata: { modules: input.modules, hasShareToken: !!shareToken },
    });

    return { report };
  });
