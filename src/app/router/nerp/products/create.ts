import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { createProduct } from "@/http/nerp/products";
import { createProductInputSchema } from "@/http/nerp/products/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const createNerpProduct = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(createProductInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    const product = await withNerpErrorTracking(integrationId, () => createProduct(config, input));
    return { product };
  });
