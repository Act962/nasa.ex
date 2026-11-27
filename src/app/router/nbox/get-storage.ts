import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { getNboxStorageUsage } from "@/features/nbox/server/storage-usage";

export const getStorage = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(({ context }) => getNboxStorageUsage(context.org.id));
