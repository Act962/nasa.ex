import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const deleteSavedReport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const report = await prisma.savedInsightReport.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, name: true },
    });
    if (!report) {
      throw new ORPCError("NOT_FOUND", { message: "Relatório não encontrado" });
    }

    await prisma.savedInsightReport.delete({ where: { id: input.id } });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "insights",
      subAppSlug: "insights-reports",
      featureKey: "insights.report.deleted",
      action: "insights.report.deleted",
      actionLabel: `Excluiu o relatório "${report.name}"`,
      resource: report.name,
      resourceId: report.id,
    });

    return { ok: true };
  });
