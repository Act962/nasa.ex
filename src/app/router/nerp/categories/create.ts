import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { createCategory } from "@/http/nerp/categories";
import { createCategoryInputSchema } from "@/http/nerp/categories/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const createNerpCategory = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(createCategoryInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    const category = await withNerpErrorTracking(integrationId, () => createCategory(config, input));
    return { category };
  });
