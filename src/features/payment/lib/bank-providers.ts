// Bancos com API que o ÓRBITA conecta (spec 0130). Vale no navegador e no servidor: a tela
// monta o passo a passo a partir daqui, e o servidor valida com as mesmas regras.

export type BankProviderId = "INTER";

export interface BankProviderInfo {
  id: BankProviderId;
  name: string;
  /** Código COMPE, para casar com o banco escolhido na conta. */
  bankCode: string;
  /** Reconhece a conta pelo nome quando ela não tem código. */
  namePattern: RegExp;
  /** Onde a pessoa cria a integração e baixa as credenciais. */
  setupSteps: string[];
  /** Escopos a marcar na integração. */
  requiredScopes: string[];
  needsCertificate: boolean;
}

export const BANK_PROVIDERS: Record<BankProviderId, BankProviderInfo> = {
  INTER: {
    id: "INTER",
    name: "Banco Inter",
    bankCode: "077",
    namePattern: /\binter(?![a-zà-ú])/i,
    setupSteps: [
      "No Internet Banking do Inter Empresas, abra Soluções para sua empresa → Nova integração.",
      "Marque as permissões de Cobrança com vencimento (cobv), Consulta de PIX e Webhook. Não marque Pagamentos nem Envio de PIX.",
      "Baixe o pacote da integração: ele traz o client_id, o client_secret, o certificado (.crt) e a chave (.key).",
    ],
    requiredScopes: ["cobv.read", "cobv.write", "pix.read", "webhook.read", "webhook.write"],
    needsCertificate: true,
  },
};

/** Pelo código COMPE ou, em conta antiga cadastrada só com o nome, pelo nome do banco. */
export function findBankProvider(account: {
  bankCode?: string | null;
  bankName?: string | null;
  name?: string | null;
}): BankProviderInfo | null {
  const providers = Object.values(BANK_PROVIDERS);
  const normalizedCode = account.bankCode?.replace(/\D/g, "").padStart(3, "0");
  const byCode = normalizedCode ? providers.find((provider) => provider.bankCode === normalizedCode) : undefined;
  if (byCode) return byCode;
  const label = `${account.bankName ?? ""} ${account.name ?? ""}`;
  return providers.find((provider) => provider.namePattern.test(label)) ?? null;
}

const FORMATTED_DOCUMENT_PATTERN = /^[\d.\-/\s]+$/;
const FORMATTED_PHONE_PATTERN = /^\+?[\d\s()\-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A chave vai ao banco como está cadastrada no PIX: CPF/CNPJ só com números, e-mail minúsculo,
 * telefone como `+55` + DDD + número. Telefone digitado com parênteses ou com `+` é telefone;
 * 11 dígitos soltos ficam como CPF, que é o caso mais comum.
 */
export function normalizePixKey(rawKey: string): string {
  const trimmedKey = rawKey.trim();
  if (EMAIL_PATTERN.test(trimmedKey)) return trimmedKey.toLowerCase();
  const isWrittenAsPhone = trimmedKey.startsWith("+") || /[()]/.test(trimmedKey);
  if (isWrittenAsPhone && FORMATTED_PHONE_PATTERN.test(trimmedKey)) {
    const digits = trimmedKey.replace(/\D/g, "");
    return trimmedKey.startsWith("+") || digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
  }
  if (FORMATTED_DOCUMENT_PATTERN.test(trimmedKey)) {
    const digits = trimmedKey.replace(/\D/g, "");
    if (digits.length === 11 || digits.length === 14) return digits;
  }
  return trimmedKey;
}
