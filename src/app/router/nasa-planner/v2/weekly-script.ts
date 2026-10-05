import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { assertPlannerOrganizationAccess } from "@/features/nasa-planner/server/cross-org";
import { parseWeeklyScript } from "@/features/nasa-planner/server/weekly-script";

/** Roteiro da semana (spec 0067): o Astro separa o texto colado em conteúdos por dia. */

export const parseWeeklyScriptText = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string(), text: z.string().trim().min(40).max(40_000) }))
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "create");
    return parseWeeklyScript({ organizationId: input.organizationId, userId: context.user.id, text: input.text });
  });
