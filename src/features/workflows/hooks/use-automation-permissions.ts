"use client";

import { useCheckPermission } from "@/hooks/use-check-permission";

// Espelho, na tela, da permissão de Automações (spec 0092). Só esconde botões: quem barra de
// verdade é o servidor (`checkWorkflowAccess`).

const TRACKING_AUTOMATIONS_APP = "tracking-automacoes";

export function useAutomationPermissions() {
  const { checkPermission, isLoading } = useCheckPermission();
  return {
    isLoading,
    canCreate: checkPermission(TRACKING_AUTOMATIONS_APP, "canCreate"),
    canEdit: checkPermission(TRACKING_AUTOMATIONS_APP, "canEdit"),
    canDelete: checkPermission(TRACKING_AUTOMATIONS_APP, "canDelete"),
  };
}
