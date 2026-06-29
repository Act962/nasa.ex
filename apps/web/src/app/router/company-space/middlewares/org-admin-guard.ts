import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { base } from "@/app/middlewares/base";

/**
 * Guard para rotas de admin da empresa (company-space).
 *
 * Exige:
 *  - usuário autenticado (session válida)
 *  - `input.orgId` presente
 *  - `Member` do usuário na org com role `owner` ou `admin`
 *
 * Uso: `.use(orgAdminGuard)` em cima da procedure (sem encadear
 * `requiredAuthMiddleware` separadamente — este faz ambos).
 */
export const orgAdminGuard = base.middleware(
  async ({ context, next, errors }, input: unknown) => {
    const orgId =
      typeof input === "object" && input !== null && "orgId" in input
        ? String((input as { orgId: string }).orgId).trim()
        : "";

    if (!orgId) {
      throw errors.BAD_REQUEST({ message: "orgId obrigatório." });
    }

    const sessionData = await auth.api.getSession({ headers: context.headers });
    if (!sessionData?.session || !sessionData.user) {
      throw errors.UNAUTHORIZED({ message: "Faça login para continuar." });
    }

    const member = await prisma.member.findFirst({
      where: {
        userId: sessionData.user.id,
        organizationId: orgId,
      },
      select: { id: true, role: true },
    });

    if (!member) {
      throw errors.FORBIDDEN({ message: "Você não faz parte desta empresa." });
    }

    const role = member.role?.toLowerCase();
    if (role !== "owner" && role !== "admin") {
      throw errors.FORBIDDEN({
        message: "Apenas owner/admin pode editar a Spacehome.",
      });
    }

    return next({
      context: {
        session: sessionData.session,
        user: sessionData.user,
        orgId,
        memberRole: role,
      },
    });
  },
);
