import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { getSale } from "@/http/nerp/sales";
import { getSaleInputSchema } from "@/http/nerp/sales/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const getNerpSale = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(getSaleInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    const sale = await withNerpErrorTracking(integrationId, () => getSale(config, input));
    return { sale };
  });
