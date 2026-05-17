import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { getDashboard } from "@/http/nerp/dashboard";
import { getDashboardInputSchema } from "@/http/nerp/dashboard/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const getNerpDashboard = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(getDashboardInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    const dashboard = await withNerpErrorTracking(integrationId, () => getDashboard(config, input));
    return { dashboard };
  });
