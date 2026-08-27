import { base } from "./base";
import {
  type PaymentResource,
  type PaymentAction,
  resolveEffectivePermissions,
} from "@/features/payment/lib/permissions";
import { ensureOrgOwnerPaymentAccess } from "@/features/payment/server/ensure-payment-access";

/**
 * Middleware de enforcement do PaymentAccess.
 *
 * Aplica-se DEPOIS de requiredAuthMiddleware + requireOrgMiddleware. Faz três
 * coisas:
 *
 * 1. Garante que existe um registro PaymentAccess autorizado para o
 *    {user, org} atual. Quem não está na whitelist é bloqueado — nem
 *    desenvolvedores veem dados financeiros sem registro explícito. A exceção
 *    é o owner da empresa, autoprovisionado pela spec 0007 para nunca ficar
 *    trancado fora do próprio financeiro.
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
      user?: { id: string; name?: string | null; email?: string | null; image?: string | null };
      org?: { id: string };
    };

    if (!ctx.user?.id || !ctx.org?.id) {
      throw errors.UNAUTHORIZED({ message: "Sessão/organização inválida" });
    }

    const access = await ensureOrgOwnerPaymentAccess(ctx.user, ctx.org.id);

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
