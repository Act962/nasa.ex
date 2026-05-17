import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { updateCustomer } from "@/http/nerp/customer";
import { updateCustomerInputSchema } from "@/http/nerp/customer/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const updateNerpCustomer = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(updateCustomerInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    const customer = await withNerpErrorTracking(integrationId, () => updateCustomer(config, input));
    return { customer };
  });
