import { decryptSecret } from "@/lib/crypto";
import type { FiscalEnvironment } from "@/generated/prisma/enums";

export function resolveCompanyToken(
  profile: {
    focusTokenHomologacao: string | null;
    focusTokenProducao: string | null;
  },
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
export function formatFocusErrorMessage(response: {
  erros?: Array<{
    codigo: string | null;
    mensagem: string;
    correcao?: string | null;
  }>;
  mensagem_erro?: unknown;
}): string | null {
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
