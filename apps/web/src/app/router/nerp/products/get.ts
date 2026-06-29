import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { getProduct } from "@/http/nerp/products";
import { getProductInputSchema } from "@/http/nerp/products/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const getNerpProduct = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(getProductInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    const product = await withNerpErrorTracking(integrationId, () => getProduct(config, input));
    return { product };
  });
