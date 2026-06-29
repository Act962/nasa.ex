import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { deleteCustomer } from "@/http/nerp/customer";
import { deleteCustomerInputSchema } from "@/http/nerp/customer/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";
import { requireOrgAdmin } from "../_access";

export const deleteNerpCustomer = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(deleteCustomerInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () => deleteCustomer(config, input));
  });
