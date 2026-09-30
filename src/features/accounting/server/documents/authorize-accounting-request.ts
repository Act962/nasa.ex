import "server-only";

import { auth } from "@/lib/auth";
import { ensureOrgOwnerPaymentAccess } from "@/features/payment/server/ensure-payment-access";
import {
  resolveEffectivePermissions,
  type PaymentAction,
  type PaymentResource,
} from "@/features/payment/lib/permissions";

// As rotas REST de documentos (multipart e redirect) não passam pelo oRPC;
// este helper reproduz o `requirePaymentAccess` para que UI e API nunca
// discordem sobre quem pode ver documento da empresa.

export interface AuthorizedAccountingRequest {
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  organizationId: string;
  role: string;
}

export type AccountingAuthorizationResult =
  | { ok: true; context: AuthorizedAccountingRequest }
  | { ok: false; status: 401 | 403; message: string };

export async function authorizeAccountingRequest(
  headers: Headers,
  resource: PaymentResource,
  action: PaymentAction,
): Promise<AccountingAuthorizationResult> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return { ok: false, status: 401, message: "Não autenticado" };

  const organization = await auth.api.getFullOrganization({ headers });
  if (!organization) return { ok: false, status: 403, message: "Nenhuma organização ativa" };

  const access = await ensureOrgOwnerPaymentAccess(session.user, organization.id);
  if (!access || !access.isAuthorized) {
    return { ok: false, status: 403, message: "Sem acesso ao módulo financeiro" };
  }

  const effective = resolveEffectivePermissions(access.role, access.permissions);
  if (!effective[resource]?.[action]) {
    return { ok: false, status: 403, message: `Sua função (${access.role}) não permite esta ação` };
  }

  return {
    ok: true,
    context: {
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      userImage: session.user.image ?? null,
      organizationId: organization.id,
      role: access.role,
    },
  };
}

export function isFinanceAdminRole(role: string | undefined | null): boolean {
  return role === "ADMIN" || role === "OWNER";
}
