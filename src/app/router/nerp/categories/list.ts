import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { listCategories } from "@/http/nerp/categories";
import { listCategoriesInputSchema } from "@/http/nerp/categories/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const listNerpCategories = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(listCategoriesInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () => listCategories(config, input));
  });
