import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { listProducts } from "@/http/nerp/products";
import { listProductsInputSchema } from "@/http/nerp/products/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const listNerpProducts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(listProductsInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () => listProducts(config, input));
  });
