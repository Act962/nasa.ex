import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { createSale } from "@/http/nerp/sales";
import { createSaleInputSchema } from "@/http/nerp/sales/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const createNerpSale = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(createSaleInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () => createSale(config, input));
  });
