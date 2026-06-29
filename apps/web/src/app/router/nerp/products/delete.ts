import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { deleteProduct } from "@/http/nerp/products";
import { deleteProductInputSchema } from "@/http/nerp/products/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";
import { requireOrgAdmin } from "../_access";

export const deleteNerpProduct = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(deleteProductInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () => deleteProduct(config, input));
  });
