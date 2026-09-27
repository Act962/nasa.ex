"use client";

import { authClient } from "@/lib/auth-client";

/**
 * Returns the current user's role in the active organization.
 *
 * Roles:
 *  - "owner"     → Master  (full access)
 *  - "admin"     → Adm     (intermediate)
 *  - "member"    → Single  (restricted)
 *  - "moderador" → Moderador (manages users)
 */
export function useOrgRole() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const { data: activeOrg, isPending: isOrgPending } =
    authClient.useActiveOrganization();

  const role: string | null =
    (activeOrg?.members as any[])?.find(
      (m: any) => m.userId === session?.user?.id,
    )?.role ?? null;

  const isSingle    = role === "member";
  const isMaster    = role === "owner";
  const isAdmin     = role === "admin";
  const isModerador = role === "moderador";
  const canManage   = isMaster || isModerador;

  // No servidor não há sessão, então o papel só é confiável depois que as duas
  // consultas respondem. Quem decide tela por papel deve esperar por isto, ou
  // o servidor renderiza "sem permissão" e o cliente troca depois (hidratação).
  const isRoleLoading = isSessionPending || isOrgPending;

  return {
    role,
    isSingle,
    isMaster,
    isAdmin,
    isModerador,
    canManage,
    isRoleLoading,
  };
}
