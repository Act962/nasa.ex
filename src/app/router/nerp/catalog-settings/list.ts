import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { listCatalogSettings } from "@/http/nerp/catalog-settings";
import { getNerpConfig } from "../_helpers";
import { withNerpErrorTracking } from "../_errors";

export const listNerpCatalogSettings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const { integrationId, config } = await getNerpConfig(context.org.id);
    const catalogSettings = await withNerpErrorTracking(integrationId, () =>
      listCatalogSettings(config),
    );
    return { catalogSettings };
  });
