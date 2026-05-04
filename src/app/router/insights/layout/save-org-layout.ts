import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { canEditInsightsLayout } from "@/lib/permissions/can-edit-insights-layout";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const insightBlockSchema = z.object({
  id: z.string(),
  type: z.enum(["section", "tag-tile", "app-metric", "custom-chart", "add-anchor"]),
  order: z.number(),
  pinnedToApps: z.array(z.string()).optional(),
  appModule: z.string().optional(),
  tagId: z.string().optional(),
  appSlug: z.string().optional(),
  metricKey: z.string().optional(),
  chartId: z.string().optional(),
  title: z.string().optional(),
  label: z.string().optional(),
});

export const saveOrgLayout = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      blocks: z.array(insightBlockSchema),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const allowed = await canEditInsightsLayout(context.user.id, context.org.id);
    if (!allowed) {
      throw errors.FORBIDDEN({
        message: "Sem permissão para editar layout de Insights",
      });
    }

    const blocks = input.blocks as Prisma.InputJsonValue;

    const layout = await prisma.organizationInsightLayout.upsert({
      where: { organizationId: context.org.id },
      create: {
        organizationId: context.org.id,
        blocks,
        updatedById: context.user.id,
      },
      update: {
        blocks,
        updatedById: context.user.id,
      },
    });

    return {
      ok: true as const,
      updatedAt: layout.updatedAt,
    };
  });
