import "server-only";

import { ORPCError } from "@orpc/server";
import { isOrgOwnerOrAdmin } from "@/features/permissions/server/is-org-admin";
import { isUserSystemAdmin } from "@/features/permissions/server/is-system-admin";
import { isMetaManagedByOrbita } from "./integration-api-key";

/**
 * Quem pode criar, alterar ou remover a integração Meta de uma org (spec 0122, RF-6):
 * owner/admin da org; se a integração é gerenciada pela Órbita, só admin do sistema.
 */
export async function assertCanManageMetaIntegration(params: {
  organizationId: string;
  userId: string;
  currentConfig: Record<string, unknown> | null;
}): Promise<{ isSystemAdmin: boolean }> {
  const isSystemAdmin = await isUserSystemAdmin(params.userId);
  if (isSystemAdmin) return { isSystemAdmin };

  if (isMetaManagedByOrbita(params.currentConfig)) {
    throw new ORPCError("FORBIDDEN", {
      message: "Esta conexão com a Meta é gerenciada pela equipe Órbita. Fale com a equipe para alterar.",
    });
  }
  if (!(await isOrgOwnerOrAdmin(params.organizationId, params.userId))) {
    throw new ORPCError("FORBIDDEN", {
      message: "Só o dono ou um administrador da empresa pode conectar a Meta.",
    });
  }
  return { isSystemAdmin };
}
