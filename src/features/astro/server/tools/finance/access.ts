import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  isPaymentActionAllowed,
  resolvePaymentPermissions,
  type ResolvedPaymentPermissions,
} from "@/features/payment/server/access/resolve-payment-permissions";
import type { PaymentAction, PaymentResource } from "@/features/payment/lib/permissions";

// Gate de permissão das tools financeiras (spec 0014, RF-1/D-4): a mesma
// matriz do middleware oRPC. Resolvido uma vez por request e cacheado no ctx.

const NO_ACCESS_MESSAGE =
  "Você não tem acesso ao módulo financeiro desta empresa. Peça ao responsável pelo financeiro pra liberar em /payment › Configurações › Acesso.";

type AccessCache = WeakMap<AgentContext, Promise<ResolvedPaymentPermissions | null>>;
const accessCache: AccessCache = new WeakMap();

async function loadPermissions(ctx: AgentContext) {
  let cached = accessCache.get(ctx);
  if (!cached) {
    cached = (async () => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { id: true, name: true, email: true, image: true },
      });
      if (!user) return null;
      return resolvePaymentPermissions(user, ctx.organizationId);
    })();
    accessCache.set(ctx, cached);
  }
  return cached;
}

export type FinanceAccessResult = { ok: true } | { ok: false; error: string };

export async function assertPaymentToolAccess(
  ctx: AgentContext,
  resource: PaymentResource,
  action: PaymentAction,
): Promise<FinanceAccessResult> {
  const resolved = await loadPermissions(ctx);
  if (!resolved) return { ok: false, error: NO_ACCESS_MESSAGE };
  if (!isPaymentActionAllowed(resolved, resource, action)) {
    return {
      ok: false,
      error: `Sua permissão no financeiro (${resolved.role}) não permite ${action} em ${resource}.`,
    };
  }
  return { ok: true };
}
