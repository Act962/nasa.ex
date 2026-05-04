import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import type { InsightBlock } from "@/lib/insights/app-metrics";
import { z } from "zod";

export const getPinnedBlocksForApp = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      appModule: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const layout = await prisma.organizationInsightLayout.findUnique({
      where: { organizationId: context.org.id },
    });

    const blocks = (layout?.blocks ?? []) as unknown as InsightBlock[];

    const pinned = blocks.filter((b) => {
      if (!("pinnedToApps" in b) || !b.pinnedToApps) return false;
      return b.pinnedToApps.includes(input.appModule as never);
    });

    return { blocks: pinned };
  });
