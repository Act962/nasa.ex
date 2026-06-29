import { base } from "./base";
import prisma from "@/lib/prisma";
import {
  type PaymentResource,
  type PaymentAction,
  resolveEffectivePermissions,
} from "@/features/payment/lib/permissions";

/**
 * Middleware de enforcement do PaymentAccess.
 *
 * Aplica-se DEPOIS de requiredAuthMiddleware + requireOrgMiddleware. Faz três
 * coisas:
 *
 * 1. Garante que existe um registro PaymentAccess autorizado para o
 *    {user, org} atual — mesmo um owner da org é bloqueado se não estiver na
 *    whitelist financeira (esse é o ponto da feature: nem desenvolvedores veem
 *    dados financeiros sem registro explícito).
 *
 * 2. Resolve permissões efetivas combinando `role` + `permissions` override
 *    (JSON por recurso). Se o recurso/action solicitado não estiver permitido,
 *    THROW FORBIDDEN.
 *
 * 3. Injeta `paymentAccess` no contexto para as procedures usarem (ex.: saber
 *    se é OWNER para mostrar UI de governança).
 */
export function requirePaymentAccess(
  resource: PaymentResource,
  action: PaymentAction,
) {
  return base.middleware(async ({ context, next, errors }) => {
    const ctx = context as typeof context & {
      user?: { id: string };
      org?: { id: string };
    };

    if (!ctx.user?.id || !ctx.org?.id) {
      throw errors.UNAUTHORIZED({ message: "Sessão/organização inválida" });
    }

    const access = await prisma.paymentAccess.findUnique({
      where: {
        userId_organizationId: {
          userId: ctx.user.id,
          organizationId: ctx.org.id,
        },
      },
    });

    if (!access || !access.isAuthorized) {
      throw errors.FORBIDDEN({
        message: "Sem acesso ao módulo financeiro",
      });
    }

    const effective = resolveEffectivePermissions(access.role, access.permissions);
    const allowed = effective[resource]?.[action] ?? false;

    if (!allowed) {
      throw errors.FORBIDDEN({
        message: `Sua role (${access.role}) não permite ${action} em ${resource}`,
      });
    }

    return next({
      context: {
        paymentAccess: access,
      },
    });
  });
}
