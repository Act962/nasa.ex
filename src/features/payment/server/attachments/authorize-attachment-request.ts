import "server-only";

import { auth } from "@/lib/auth";
import { ensureOrgOwnerPaymentAccess } from "@/features/payment/server/ensure-payment-access";
import {
  resolveEffectivePermissions,
  type PaymentAction,
} from "@/features/payment/lib/permissions";

// As rotas de upload/download de anexo são REST (precisam de multipart e de
// redirect), então não passam pelo `requirePaymentAccess` do oRPC. Este helper
// reproduz o mesmo enforcement pra que UI e API nunca discordem sobre quem
// pode ver documento financeiro — spec 0008, RNF-1.

interface AuthorizedRequest {
  userId: string;
  organizationId: string;
}

type AuthorizationFailure = {
  status: 401 | 403;
  message: string;
};

type AuthorizationResult =
  | { ok: true; context: AuthorizedRequest }
  | { ok: false; failure: AuthorizationFailure };

export async function authorizeAttachmentRequest(
  headers: Headers,
  action: PaymentAction,
): Promise<AuthorizationResult> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) {
    return { ok: false, failure: { status: 401, message: "Não autenticado" } };
  }

  const organization = await auth.api.getFullOrganization({ headers });
  if (!organization) {
    return {
      ok: false,
      failure: { status: 403, message: "Nenhuma organização ativa" },
    };
  }

  const access = await ensureOrgOwnerPaymentAccess(session.user, organization.id);
  if (!access || !access.isAuthorized) {
    return {
      ok: false,
      failure: { status: 403, message: "Sem acesso ao módulo financeiro" },
    };
  }

  const effective = resolveEffectivePermissions(access.role, access.permissions);
  if (!effective.entries?.[action]) {
    return {
      ok: false,
      failure: {
        status: 403,
        message: `Sua role (${access.role}) não permite ${action} em lançamentos`,
      },
    };
  }

  return {
    ok: true,
    context: { userId: session.user.id, organizationId: organization.id },
  };
}
