import { base } from "./base";
import prisma from "@/lib/prisma";

/**
 * Exige que o usuário autenticado seja admin de sistema (isSystemAdmin = true).
 * Encadeie após requiredAuthMiddleware. Confere direto no banco — não confia no
 * cache da sessão, pelo mesmo motivo do requireAdminMiddleware.
 */
export const requireSystemAdminMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const user = (context as { user?: { id?: string } }).user;
    if (!user?.id) throw errors.UNAUTHORIZED({ message: "Não autorizado" });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSystemAdmin: true },
    });
    if (!dbUser?.isSystemAdmin) throw errors.FORBIDDEN({ message: "Sem permissão" });

    return next({ context: {} });
  },
);
