"use client";

import { useOrgRole } from "@/hooks/use-org-role";

/**
 * Retorna se o usuário logado tem `billing-role` na org ativa
 * (owner ou admin), conforme [docs/subscription-org-model.md].
 *
 * Quem retorna `true` pode: assinar planos, abrir o billing portal,
 * cancelar/upgrade. `member`/`moderador` só usufruem.
 */
export function useCanManageBilling() {
  const { isMaster, isAdmin } = useOrgRole();
  return isMaster || isAdmin;
}
