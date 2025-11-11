import { auth } from "@/lib/auth";
import { base } from "../middlewares/base";

export const requiredAuthMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const sessionData = await auth.api.getSession({
      headers: context.headers,
    });

    if (!sessionData?.session || !sessionData.user) {
      throw errors.UNAUTHORIZED;
    }

    const organization = await auth.api.getFullOrganization({
      headers: context.headers,
    });

    return next({
      context: {
        session: sessionData.session,
        user: sessionData.user,
        org: organization,
      },
    });
  }
);
