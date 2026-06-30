import { decryptSecret } from "@/lib/crypto";
import type { FiscalEnvironment, FiscalInvoiceStatus } from "@/generated/prisma/enums";

export function resolveCompanyToken(
  profile: { focusTokenHomologacao: string | null; focusTokenProducao: string | null },
  environment: FiscalEnvironment,
): string {
  const encrypted =
    environment === "HOMOLOGACAO"
      ? profile.focusTokenHomologacao
      : profile.focusTokenProducao;
  if (!encrypted)
    throw new Error(
      `Token Focus NFe por empresa ausente para ambiente ${environment}. Salve o perfil fiscal novamente.`,
    );
  return decryptSecret(encrypted);
}

export function focusStatusToDb(focusStatus: string): FiscalInvoiceStatus {
  switch (focusStatus) {
    case "autorizado":
      return "AUTORIZADO";
    case "erro_autorizacao":
      return "ERRO";
    case "cancelado":
      return "CANCELADO";
    default:
      return "PROCESSANDO";
  }
}
