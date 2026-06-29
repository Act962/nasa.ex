import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { listSales } from "@/http/nerp/sales";
import { listSalesInputSchema } from "@/http/nerp/sales/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const listNerpSales = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(listSalesInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () => listSales(config, input));
  });
