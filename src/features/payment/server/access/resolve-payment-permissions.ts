import "server-only";

import {
  ensureOrgOwnerPaymentAccess,
  type PaymentAccessActor,
} from "@/features/payment/server/ensure-payment-access";
import {
  resolveEffectivePermissions,
  type PaymentAction,
  type PaymentPermissionMatrix,
  type PaymentResource,
} from "@/features/payment/lib/permissions";

// Uma única resposta para "este usuário pode fazer X no financeiro desta org?"
// — o middleware oRPC, as rotas REST de anexo e as tools do Astro leem daqui,
// para que UI, API e assistente nunca discordem sobre quem tem acesso.

export interface ResolvedPaymentPermissions {
  accessId: string;
  role: "VIEWER" | "EDITOR" | "ADMIN" | "OWNER";
  permissions: PaymentPermissionMatrix;
}

export async function resolvePaymentPermissions(
  actor: PaymentAccessActor,
  organizationId: string,
): Promise<ResolvedPaymentPermissions | null> {
  const access = await ensureOrgOwnerPaymentAccess(actor, organizationId);
  if (!access || !access.isAuthorized) return null;
  return {
    accessId: access.id,
    role: access.role,
    permissions: resolveEffectivePermissions(access.role, access.permissions),
  };
}

export function isPaymentActionAllowed(
  resolved: ResolvedPaymentPermissions | null,
  resource: PaymentResource,
  action: PaymentAction,
): boolean {
  return resolved?.permissions[resource]?.[action] ?? false;
}
