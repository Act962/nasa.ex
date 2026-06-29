import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { computeSetupProgress } from "../utils";

export const getSetupProgress = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    return computeSetupProgress({
      userId: context.user.id,
      orgId: context.org.id,
    });
  });
