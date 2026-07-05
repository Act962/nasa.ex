import { decryptSecret } from "@/lib/crypto";
import type { FiscalEnvironment, FiscalInvoiceStatus } from "@/generated/prisma/enums";
import type { FocusNfseResponse } from "@/http/focus-nfe/types";

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

// Mensagem crua da prefeitura é a rede de segurança do registry de municípios
// (docs/nfs/municipios-requirements.md) — erro recorrente vira override novo.
export function formatFocusErrorMessage(
  response: FocusNfseResponse,
): string | null {
  if (response.erros?.length) {
    return response.erros
      .map((erro) => {
        const codigo = erro.codigo ? `[${erro.codigo}] ` : "";
        const correcao = erro.correcao ? ` Correção: ${erro.correcao}` : "";
        return `${codigo}${erro.mensagem}${correcao}`;
      })
      .join(" | ");
  }
  const mensagemErro = response.mensagem_erro;
  return typeof mensagemErro === "string" && mensagemErro ? mensagemErro : null;
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
