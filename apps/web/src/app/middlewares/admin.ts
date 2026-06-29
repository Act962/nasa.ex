import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { base } from "./base";

/**
 * Middleware that requires the user to be authenticated AND have isSystemAdmin = true.
 * This is checked server-side on every request — never trust client-only guards.
 * Sensitive fields (API keys, tokens, passwords) are NEVER selected in admin routes.
 */
export const requireAdminMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const sessionData = await auth.api.getSession({
      headers: context.headers,
    });

    if (!sessionData?.session || !sessionData.user) {
      throw errors.UNAUTHORIZED({ message: "Não autorizado" });
    }

    // Verify isSystemAdmin directly from DB — do not trust session cache
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionData.user.id },
      select: { id: true, name: true, email: true, isSystemAdmin: true },
    });

    if (!dbUser?.isSystemAdmin) {
      throw errors.FORBIDDEN({ message: "Sem permissão" });
    }

    return next({
      context: {
        session: sessionData.session,
        adminUser: dbUser,
      },
    });
  },
);
