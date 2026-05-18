import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { updateNerpSubdomain } from "@/http/nerp/org";
import { updateSubdomainInputSchema } from "@/http/nerp/org/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";
import { requireOrgAdmin } from "../_access";

// Alterar subdomínio impacta a URL pública da loja — exigir admin da org.
export const updateNerpSubdomainProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(updateSubdomainInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () =>
      updateNerpSubdomain(config, input),
    );
  });
