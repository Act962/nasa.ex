"use client";

import { useCheckPermission } from "@/hooks/use-check-permission";
import { useOrgRole } from "@/hooks/use-org-role";

// Espelho, na tela, da permissão de Automações (spec 0092). Só esconde botões: quem barra de
// verdade é o servidor (`checkWorkflowAccess`).

const TRACKING_AUTOMATIONS_APP = "tracking-automacoes";

export function useAutomationPermissions() {
  const { checkPermission, isLoading: isMatrixLoading } = useCheckPermission();
  // Sem o papel ainda carregado, `checkPermission` responde "não" e a matriz nem começou a carregar.
  const { isRoleLoading } = useOrgRole();
  return {
    isLoading: isRoleLoading || isMatrixLoading,
    canView: checkPermission(TRACKING_AUTOMATIONS_APP, "canView"),
    canCreate: checkPermission(TRACKING_AUTOMATIONS_APP, "canCreate"),
    canEdit: checkPermission(TRACKING_AUTOMATIONS_APP, "canEdit"),
    canDelete: checkPermission(TRACKING_AUTOMATIONS_APP, "canDelete"),
  };
}
