import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { getNerpOrg } from "@/http/nerp/org";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const getNerpOrgProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    const org = await withNerpErrorTracking(integrationId, () =>
      getNerpOrg(config),
    );
    return { org };
  });
