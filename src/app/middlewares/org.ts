import { auth } from "@/lib/auth";
import { base } from "./base";

export const requireOrgMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const organization = await auth.api.getFullOrganization({
      headers: context.headers,
    });

    if (!organization) {
      throw errors.FORBIDDEN;
    }

    // Adds session and user to the context
    return next({
      context: {
        org: organization,
      },
    });
  }
);
