import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { getMetaAuth } from "../meta-ads/_helpers";

export const getActiveMetaSelection = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const auth = await getMetaAuth(context.org.id, { userId: context.user.id });
    if (!auth) return { connected: false, adAccountId: null };
    return { connected: true, adAccountId: auth.adAccountId };
  });
