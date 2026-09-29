import { base } from "./base";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import type { PermissionAction } from "@/features/permissions/lib/app-permission-catalog";

const ACTION_LABELS: Record<PermissionAction, string> = {
  canView: "ver",
  canCreate: "criar",
  canEdit: "editar",
  canDelete: "excluir",
  canApprove: "aprovar",
  canPay: "pagar",
};

// Usar depois de requiredAuthMiddleware + requireOrgMiddleware.
export function requireAppPermission(appKey: string, action: PermissionAction) {
  return base
    .$context<{ headers: Headers; user: { id: string }; org: { id: string } }>()
    .middleware(async ({ context, next, errors }) => {
      const isAllowed = await hasAppPermission(context.org.id, context.user.id, appKey, action);
      if (!isAllowed) {
        throw errors.FORBIDDEN({
          message: `Seu papel não tem permissão para ${ACTION_LABELS[action]} neste módulo. Fale com o Master (Configurações → Permissões).`,
        });
      }
      return next();
    });
}
