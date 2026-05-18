import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { checkNerpSubdomain } from "@/http/nerp/org";
import { checkSubdomainInputSchema } from "@/http/nerp/org/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const checkNerpSubdomainProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(checkSubdomainInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () =>
      checkNerpSubdomain(config, input),
    );
  });
