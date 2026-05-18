import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { updateCategory } from "@/http/nerp/categories";
import { updateCategoryInputSchema } from "@/http/nerp/categories/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const updateNerpCategory = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(updateCategoryInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () => updateCategory(config, input));
  });
