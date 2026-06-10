import "server-only";

import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";

/**
 * Helpers de credenciais Meta Cloud API (Fase 4 — Roadmap WhatsApp Oficial).
 *
 * A coluna `WhatsAppInstance.meta*` guarda valores **cifrados** (AES-256-GCM
 * via `@/lib/crypto`). Estes helpers concentram dois movimentos:
 *
 *  - **Encrypt em entrada** (`encryptMetaCredentialsInput`): vem do form
 *    da UI em texto claro → vai pro banco cifrado. Strings vazias /
 *    `undefined` significam "não alterar" no update; só cifra valores
 *    realmente preenchidos.
 *
 *  - **Mask em saída** (`maskMetaCredentials`): a UI **nunca** recebe o
 *    valor em claro de volta — só `hasX: boolean` (existe segredo?) +
 *    `lastX: string | null` (últimos 4 chars). Operacional pra confirmar
 *    "qual token tá lá" sem expor o segredo inteiro nos logs.
 *
 * Pra ler em claro no caminho de envio/webhook (Fase 5+6), use
 * `decryptStoredMetaCredentials` — ele lança se algum campo obrigatório
 * estiver faltando no banco.
 */

export interface MetaCredentialsInput {
  readonly accessToken?: string | null;
  readonly phoneNumberId?: string | null;
  readonly appSecret?: string | null;
  readonly verifyToken?: string | null;
  readonly businessAccountId?: string | null;
}

export interface MetaCredentialsCipher {
  metaAccessToken: string | null;
  metaPhoneNumberId: string | null;
  metaAppSecret: string | null;
  metaVerifyToken: string | null;
  metaBusinessAccountId: string | null;
}

export interface MetaCredentialsStored {
  readonly metaAccessToken: string | null;
  readonly metaPhoneNumberId: string | null;
  readonly metaAppSecret: string | null;
  readonly metaVerifyToken: string | null;
  readonly metaBusinessAccountId: string | null;
}

export interface MetaCredentialsMasked {
  readonly hasAccessToken: boolean;
  readonly lastAccessToken: string | null;
  readonly hasPhoneNumberId: boolean;
  readonly lastPhoneNumberId: string | null;
  readonly hasAppSecret: boolean;
  readonly lastAppSecret: string | null;
  readonly hasVerifyToken: boolean;
  readonly lastVerifyToken: string | null;
  readonly hasBusinessAccountId: boolean;
  readonly lastBusinessAccountId: string | null;
}

export interface MetaCredentialsPlain {
  readonly accessToken: string;
  readonly phoneNumberId: string;
  readonly appSecret: string;
  readonly verifyToken: string;
  readonly businessAccountId: string | null;
}

/**
 * Variante de `MetaCredentialsPlain` pra Fase 7: instâncias provisionadas
 * via Embedded Signup têm `appSecret`/`verifyToken` NULL no banco (vão
 * usar env global). Só `accessToken` e `phoneNumberId` são obrigatórios.
 */
export interface MetaCredentialsPartialPlain {
  readonly accessToken: string;
  readonly phoneNumberId: string;
  readonly appSecret: string | null;
  readonly verifyToken: string | null;
  readonly businessAccountId: string | null;
}

/**
 * Converte input do formulário em payload de update do Prisma:
 *
 *  - Valor não-vazio  → cifra e grava.
 *  - Valor `null`     → "limpar campo" (UI explicita zerar).
 *  - `undefined`      → não tocar (omite do `data` do Prisma).
 *
 * O retorno é um objeto **parcial** — só inclui as chaves do input que
 * o caller realmente passou (`undefined` é filtrado). O `data` do
 * `prisma.whatsAppInstance.update` aceita esse shape direto.
 */
export function encryptMetaCredentialsInput(
  input: MetaCredentialsInput,
): Partial<MetaCredentialsCipher> {
  const result: Partial<MetaCredentialsCipher> = {};
  if (input.accessToken !== undefined) {
    result.metaAccessToken = encryptIfPresent(input.accessToken);
  }
  if (input.phoneNumberId !== undefined) {
    result.metaPhoneNumberId = encryptIfPresent(input.phoneNumberId);
  }
  if (input.appSecret !== undefined) {
    result.metaAppSecret = encryptIfPresent(input.appSecret);
  }
  if (input.verifyToken !== undefined) {
    result.metaVerifyToken = encryptIfPresent(input.verifyToken);
  }
  if (input.businessAccountId !== undefined) {
    result.metaBusinessAccountId = encryptIfPresent(input.businessAccountId);
  }
  return result;
}

/**
 * Retorna o shape mascarado (boolean + last4) seguro pra UI/oRPC.
 * Decifrar é tolerante: se o segredo no banco estiver corrompido
 * (rotacionaram `AI_SECRETS_KEY` sem re-encriptar), o helper devolve
 * `last = null` em vez de quebrar o GET inteiro — operador percebe
 * a falha sem perder acesso à página.
 */
export function maskMetaCredentials(
  stored: MetaCredentialsStored,
): MetaCredentialsMasked {
  return {
    hasAccessToken: Boolean(stored.metaAccessToken),
    lastAccessToken: safeLast4(stored.metaAccessToken),
    hasPhoneNumberId: Boolean(stored.metaPhoneNumberId),
    lastPhoneNumberId: safeLast4(stored.metaPhoneNumberId),
    hasAppSecret: Boolean(stored.metaAppSecret),
    lastAppSecret: safeLast4(stored.metaAppSecret),
    hasVerifyToken: Boolean(stored.metaVerifyToken),
    lastVerifyToken: safeLast4(stored.metaVerifyToken),
    hasBusinessAccountId: Boolean(stored.metaBusinessAccountId),
    lastBusinessAccountId: safeLast4(stored.metaBusinessAccountId),
  };
}

/**
 * Decifra as 4 credenciais obrigatórias (accessToken, phoneNumberId,
 * appSecret, verifyToken) pra uso no caminho de envio/webhook. Lança
 * `MetaCredentialsMissingError` se qualquer obrigatória estiver
 * ausente — o caller decide se retorna 412/503 etc.
 *
 * `businessAccountId` é opcional (só usado em fluxos de template/HSM)
 * e devolve `null` quando ausente.
 */
export function decryptStoredMetaCredentials(
  stored: MetaCredentialsStored,
): MetaCredentialsPlain {
  const missing: string[] = [];
  if (!stored.metaAccessToken) missing.push("accessToken");
  if (!stored.metaPhoneNumberId) missing.push("phoneNumberId");
  if (!stored.metaAppSecret) missing.push("appSecret");
  if (!stored.metaVerifyToken) missing.push("verifyToken");
  if (missing.length > 0) {
    throw new MetaCredentialsMissingError(missing);
  }
  return {
    accessToken: decryptSecret(stored.metaAccessToken!),
    phoneNumberId: decryptSecret(stored.metaPhoneNumberId!),
    appSecret: decryptSecret(stored.metaAppSecret!),
    verifyToken: decryptSecret(stored.metaVerifyToken!),
    businessAccountId: stored.metaBusinessAccountId
      ? decryptSecret(stored.metaBusinessAccountId)
      : null,
  };
}

/**
 * Variante "partial" do `decryptStoredMetaCredentials` pra Fase 7:
 * - `accessToken` e `phoneNumberId` continuam OBRIGATÓRIOS (sem eles, nem
 *   webhook nem envio funcionam — não dá pra dar fallback global).
 * - `appSecret` e `verifyToken` ficam OPCIONAIS — instâncias Embedded
 *   Signup gravam NULL nessas colunas e o webhook usa env global.
 *
 * Quem chama decide: usar a coluna se presente, ou cair pro env.
 * Lança `MetaCredentialsMissingError` se accessToken/phoneNumberId
 * faltarem (errado-pra-todo-cenário).
 */
export function decryptStoredMetaCredentialsPartial(
  stored: MetaCredentialsStored,
): MetaCredentialsPartialPlain {
  const missing: string[] = [];
  if (!stored.metaAccessToken) missing.push("accessToken");
  if (!stored.metaPhoneNumberId) missing.push("phoneNumberId");
  if (missing.length > 0) {
    throw new MetaCredentialsMissingError(missing);
  }
  return {
    accessToken: decryptSecret(stored.metaAccessToken!),
    phoneNumberId: decryptSecret(stored.metaPhoneNumberId!),
    appSecret: stored.metaAppSecret ? decryptSecret(stored.metaAppSecret) : null,
    verifyToken: stored.metaVerifyToken ? decryptSecret(stored.metaVerifyToken) : null,
    businessAccountId: stored.metaBusinessAccountId
      ? decryptSecret(stored.metaBusinessAccountId)
      : null,
  };
}

export class MetaCredentialsMissingError extends Error {
  readonly fields: readonly string[];
  constructor(fields: readonly string[]) {
    super(
      `Credenciais Meta ausentes: ${fields.join(", ")}. Configure em /tracking/.../settings → Integrações.`,
    );
    this.name = "MetaCredentialsMissingError";
    this.fields = fields;
  }
}

function encryptIfPresent(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return encryptSecret(trimmed);
}

function safeLast4(cipher: string | null): string | null {
  if (!cipher) return null;
  try {
    return last4(decryptSecret(cipher));
  } catch {
    return null;
  }
}
