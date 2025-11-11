import { base } from "../middlewares/base";

import { currentOrganization, requireAuth } from "@/lib/auth-utils";

export const requiredAuthMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const session = await requireAuth();

    if (!session) {
      throw errors.UNAUTHORIZED;
    }
    const organization = await currentOrganization();

    return next({
      context: {
        ...context,
        auth: session,
        org: organization,
      },
    });
  }
);
