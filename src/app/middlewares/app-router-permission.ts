import { auth } from "@/lib/auth";
import { base } from "./base";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import { resolveProcedureAction } from "@/features/permissions/lib/procedure-action";
import type { PermissionAction } from "@/features/permissions/lib/app-permission-catalog";

const ACTION_LABELS: Record<PermissionAction, string> = {
  canView: "ver",
  canCreate: "criar",
  canEdit: "editar",
  canDelete: "excluir",
  canApprove: "aprovar",
  canPay: "pagar",
};

type AppRouterGuardOptions = {
  // Trechos de path que não passam por esta chave (ex.: rotas públicas ou
  // procedures que já checam outra chave da matriz).
  skipPathSegments?: string[];
};

// Aplica a matriz de Permissões a um router inteiro. Roda antes dos
// middlewares de cada procedure, então resolve a sessão por conta própria;
// sem sessão ou sem org ativa, deixa a procedure decidir (rotas públicas).
export function appRouterPermission(appKey: string, options: AppRouterGuardOptions = {}) {
  const skipSegments = new Set(options.skipPathSegments ?? []);
  return base.middleware(async ({ context, next, path, errors }) => {
    if (path.some((segment) => skipSegments.has(segment) || segment.toLowerCase().includes("public"))) {
      return next();
    }
    const sessionData = await auth.api.getSession({ headers: context.headers });
    const organizationId = sessionData?.session.activeOrganizationId;
    if (!sessionData?.user || !organizationId) return next();

    const action = resolveProcedureAction(path[path.length - 1] ?? "");
    const isAllowed = await hasAppPermission(organizationId, sessionData.user.id, appKey, action);
    if (!isAllowed) {
      throw errors.FORBIDDEN({
        message: `Seu papel não tem permissão para ${ACTION_LABELS[action]} neste app. Fale com o Master (Configurações → Permissões).`,
      });
    }
    return next();
  });
}
