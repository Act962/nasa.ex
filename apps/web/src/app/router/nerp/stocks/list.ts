import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { listStocks } from "@/http/nerp/stocks";
import { listStocksInputSchema } from "@/http/nerp/stocks/schemas";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const listNerpStocks = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(listStocksInputSchema)
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    return withNerpErrorTracking(integrationId, () => listStocks(config, input));
  });
