import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { duplicateProduct } from "@/http/nerp/products";
import { duplicateProductInputSchema } from "@/http/nerp/products/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const duplicateNerpProduct = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(duplicateProductInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () => duplicateProduct(config, input));
  });
