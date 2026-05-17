import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { createCustomer } from "@/http/nerp/customer";
import { createCustomerInputSchema } from "@/http/nerp/customer/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const createNerpCustomer = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(createCustomerInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    const customer = await withNerpErrorTracking(integrationId, () => createCustomer(config, input));
    return { customer };
  });
