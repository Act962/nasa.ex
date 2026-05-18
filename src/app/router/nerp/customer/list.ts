import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { listCustomers } from "@/http/nerp/customer";
import { listCustomersInputSchema } from "@/http/nerp/customer/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const listNerpCustomers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(listCustomersInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () => listCustomers(config, input));
  });
