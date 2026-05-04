import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { canEditInsightsLayout } from "@/lib/permissions/can-edit-insights-layout";
import type { InsightBlock } from "@/lib/insights/app-metrics";

export const getOrgLayout = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const layout = await prisma.organizationInsightLayout.findUnique({
      where: { organizationId: context.org.id },
    });

    const blocks = (layout?.blocks ?? []) as unknown as InsightBlock[];
    const canEdit = await canEditInsightsLayout(context.user.id, context.org.id);

    return {
      blocks,
      canEdit,
      updatedAt: layout?.updatedAt ?? null,
      updatedById: layout?.updatedById ?? null,
    };
  });
