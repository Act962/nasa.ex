import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { getDashboard } from "@/http/nerp/dashboard";
import { getDashboardInputSchema } from "@/http/nerp/dashboard/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

// Apesar do nome local `getNerpDashboard`, no nerp essa procedure se chama
// `dashboard.list`. Mantemos o nome local pra não quebrar `orpc.nerp.dashboard.get`.
export const getNerpDashboard = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(getDashboardInputSchema)
  .handler(async ({ context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () => getDashboard(config));
  });
