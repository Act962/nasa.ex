import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { getCustomer } from "@/http/nerp/customer";
import { getCustomerInputSchema } from "@/http/nerp/customer/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const getNerpCustomer = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(getCustomerInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    const customer = await withNerpErrorTracking(integrationId, () => getCustomer(config, input));
    return { customer };
  });
