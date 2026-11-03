import "server-only";
import prisma from "@/lib/prisma";
import { decryptSecret, encryptSecret, last4, type SecretOptions } from "@/lib/crypto";
import { resolvePublicOrigin } from "@/lib/public-origin";
import type { PaymentBankConnection } from "@/generated/prisma/client";
import { getBankAdapter } from "./bank-adapters";
import type { BankBoletoProvider, BankChargeProvider, BankCredentials } from "./ports";

// Lê e grava a conexão bancária (spec 0130). Única porta de entrada para os segredos:
// decifra só aqui, e nada daqui volta para o navegador além de `toBankConnectionSummary`.

const TOKEN_RENEW_MARGIN_MS = 5 * 60 * 1000;

export function bankSecretOptions(organizationId: string): SecretOptions {
  return { keyName: "BANK_SECRETS_KEY", additionalData: `${organizationId}:bank` };
}

export function encryptBankSecret(organizationId: string, plain: string): string {
  return encryptSecret(plain, bankSecretOptions(organizationId));
}

export function readConnectionCredentials(connection: PaymentBankConnection): BankCredentials {
  const options = bankSecretOptions(connection.organizationId);
  return {
    environment: connection.environment === "sandbox" ? "sandbox" : "production",
    clientId: connection.clientId,
    clientSecret: decryptSecret(connection.clientSecretEnc, options),
    certificatePem: connection.certificateEnc ? decryptSecret(connection.certificateEnc, options) : null,
    privateKeyPem: connection.privateKeyEnc ? decryptSecret(connection.privateKeyEnc, options) : null,
    pixKey: connection.pixKey,
    accountNumber: connection.accountNumber,
  };
}

/**
 * Token reaproveitado até 5 min antes de vencer (D-6): o Inter aceita só 5 pedidos de token
 * por minuto. A gravação é condicional, para dois renovadores simultâneos não se atropelarem.
 */
/** O banco emite boleto e a integração tem as permissões conferidas (spec 0133). */
export function hasBoletoPermission(connection: PaymentBankConnection): boolean {
  const boletoScopes = getBankAdapter(connection.provider).permissionScopes.boleto;
  if (!boletoScopes || !connection.permissionsCheckedAt) return false;
  const granted = new Set(connection.scopes.split(" "));
  return boletoScopes.every((scope) => granted.has(scope));
}

/** As cobranças novas saem como boleto. Boleto já emitido segue sendo gerido mesmo desligado. */
export function isBoletoEnabled(connection: PaymentBankConnection): boolean {
  return connection.chargeMethod === "BOLETO_PIX" && hasBoletoPermission(connection);
}

async function getConnectionAccessToken(
  connection: PaymentBankConnection,
  credentials: BankCredentials,
): Promise<string> {
  const current = await prisma.paymentBankConnection.findUnique({
    where: { id: connection.id },
    select: { accessTokenEnc: true, accessTokenExpiresAt: true },
  });
  const options = bankSecretOptions(connection.organizationId);
  if (
    current?.accessTokenEnc &&
    current.accessTokenExpiresAt &&
    current.accessTokenExpiresAt.getTime() - TOKEN_RENEW_MARGIN_MS > Date.now()
  ) {
    return decryptSecret(current.accessTokenEnc, options);
  }

  // `scopes` guarda as permissões conferidas na API; o token não as prova, então não as sobrescreve.
  const token = await getBankAdapter(connection.provider).requestAccessToken(credentials, {
    includeBoleto: hasBoletoPermission(connection),
  });
  await prisma.paymentBankConnection.updateMany({
    where: { id: connection.id, accessTokenExpiresAt: current?.accessTokenExpiresAt ?? null },
    data: {
      accessTokenEnc: encryptSecret(token.accessToken, options),
      accessTokenExpiresAt: token.expiresAt,
    },
  });
  return token.accessToken;
}

export interface ConnectedBank {
  connection: PaymentBankConnection;
  credentials: BankCredentials;
  provider: BankChargeProvider;
  /** `null` quando o banco não emite boleto ou a integração não tem a permissão. */
  boletoProvider: BankBoletoProvider | null;
  getAccessToken: () => Promise<string>;
}

export function openConnectedBank(connection: PaymentBankConnection): ConnectedBank {
  const credentials = readConnectionCredentials(connection);
  let accessTokenPromise: Promise<string> | null = null;
  const getAccessToken = () => {
    accessTokenPromise ??= getConnectionAccessToken(connection, credentials).catch((error: unknown) => {
      accessTokenPromise = null;
      throw error;
    });
    return accessTokenPromise;
  };
  const adapter = getBankAdapter(connection.provider);
  return {
    connection,
    credentials,
    getAccessToken,
    provider: adapter.createChargeProvider(credentials, getAccessToken),
    boletoProvider:
      hasBoletoPermission(connection) && adapter.createBoletoProvider
        ? adapter.createBoletoProvider(credentials, getAccessToken)
        : null,
  };
}

export function isCertificateExpired(connection: Pick<PaymentBankConnection, "certificateValidTo">): boolean {
  return Boolean(connection.certificateValidTo && connection.certificateValidTo.getTime() <= Date.now());
}

/** Conexão que gera o PIX das cobranças da empresa (RF-3), mesmo com certificado vencido: quem chama decide. */
export async function findChargeConnection(organizationId: string): Promise<PaymentBankConnection | null> {
  return prisma.paymentBankConnection.findFirst({
    where: { organizationId, isDefaultForCharges: true, account: { isActive: true } },
  });
}

export async function recordConnectionFailure(connectionId: string, message: string): Promise<void> {
  await prisma.paymentBankConnection
    .update({ where: { id: connectionId }, data: { lastErrorMessage: message.slice(0, 500), lastErrorAt: new Date() } })
    .catch((error: unknown) => console.error("[bank-connection] failed to record failure", error));
}

/**
 * O banco voltou a responder: tira o aviso de problema. Só com o aviso de pagamento ativo —
 * sem ele, a mensagem guardada explica por que a baixa automática está pendente.
 */
export async function clearConnectionFailure(connection: PaymentBankConnection): Promise<void> {
  if (!connection.lastErrorMessage || !connection.webhookRegisteredAt) return;
  await prisma.paymentBankConnection
    .update({ where: { id: connection.id }, data: { lastErrorMessage: null, lastErrorAt: null } })
    .catch((error: unknown) => console.error("[bank-connection] failed to clear failure", error));
}

/**
 * Fora de produção só com `BANK_WEBHOOK_PUBLIC_ORIGIN` (túnel): o `.env.local` costuma apontar
 * para o endereço de produção, e cadastrar dali trocaria o aviso real da chave PIX no banco.
 */
export function buildBankWebhookUrl(connection: Pick<PaymentBankConnection, "id" | "webhookToken">): string | null {
  const origin =
    process.env.BANK_WEBHOOK_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") ||
    (process.env.NODE_ENV === "production" ? resolvePublicOrigin() : null);
  if (!origin) return null;
  return `${origin}/api/payment/bank-webhook/${connection.id}/${connection.webhookToken}`;
}

export type BankConnectionStatus = "ACTIVE" | "CERTIFICATE_EXPIRED" | "WEBHOOK_PENDING" | "ERROR";

function bpsToPercent(basisPoints: number | null): number | null {
  return basisPoints === null ? null : basisPoints / 100;
}

export function toBankConnectionSummary(connection: PaymentBankConnection) {
  const adapter = getBankAdapter(connection.provider);
  const scopes = connection.scopes.split(" ").filter(Boolean);
  const granted = new Set(scopes);
  // Antes da conferência (conexões da 0130), as listas de faltando ficam desconhecidas.
  const isChecked = connection.permissionsCheckedAt !== null;
  const missingOf = (required: readonly string[]) => (isChecked ? required.filter((scope) => !granted.has(scope)) : null);
  const status: BankConnectionStatus = isCertificateExpired(connection)
    ? "CERTIFICATE_EXPIRED"
    : !connection.webhookRegisteredAt
      ? "WEBHOOK_PENDING"
      : connection.lastErrorMessage
        ? "ERROR"
        : "ACTIVE";
  return {
    id: connection.id,
    provider: connection.provider,
    environment: connection.environment === "sandbox" ? ("sandbox" as const) : ("production" as const),
    clientIdLast4: last4(connection.clientId),
    certificateValidTo: connection.certificateValidTo,
    scopes,
    moneyMovingScopes: adapter.findMoneyMovingScopes(scopes),
    permissionsCheckedAt: connection.permissionsCheckedAt,
    missingForPix: missingOf(adapter.permissionScopes.pix),
    missingForBoleto: adapter.permissionScopes.boleto ? missingOf(adapter.permissionScopes.boleto) : null,
    isBoletoSupported: adapter.permissionScopes.boleto !== null,
    chargeMethod: connection.chargeMethod,
    isBoletoActive: isBoletoEnabled(connection),
    boletoWebhookRegisteredAt: connection.boletoWebhookRegisteredAt,
    boletoFinePercent: bpsToPercent(connection.boletoFineBps),
    boletoInterestMonthlyPercent: bpsToPercent(connection.boletoInterestMonthlyBps),
    boletoDiscountPercent: bpsToPercent(connection.boletoDiscountBps),
    boletoDiscountDays: connection.boletoDiscountDays,
    pixKey: connection.pixKey,
    accountNumber: connection.accountNumber,
    isDefaultForCharges: connection.isDefaultForCharges,
    webhookRegisteredAt: connection.webhookRegisteredAt,
    lastErrorMessage: connection.lastErrorMessage,
    lastErrorAt: connection.lastErrorAt,
    connectedAt: connection.createdAt,
    status,
  };
}

export type BankConnectionSummary = ReturnType<typeof toBankConnectionSummary>;
