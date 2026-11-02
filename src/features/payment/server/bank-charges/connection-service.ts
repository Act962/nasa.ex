import "server-only";
import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { hasSecretKey } from "@/lib/crypto";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { normalizePixKey } from "@/features/payment/lib/bank-providers";
import type { PaymentBankConnection } from "@/generated/prisma/client";
import { getBankAdapter } from "./bank-adapters";
import {
  buildBankWebhookUrl,
  encryptBankSecret,
  openConnectedBank,
  readConnectionCredentials,
  toBankConnectionSummary,
  type BankConnectionSummary,
} from "./connection-store";
import { cancelOpenBankPixOfConnection } from "./charge-pix";
import { BankConnectionError, type BankChargeProviderName, type BankCredentials } from "./ports";

// Conectar, testar, desconectar e escolher a conta das cobranças (spec 0130, RF-1, RF-3, RF-10).
// Quem chama já conferiu que a pessoa é dona ou administradora.

export interface BankActor {
  id: string;
  name: string;
  email: string;
}

export type BankConnectionResult =
  | { ok: true; connection: BankConnectionSummary }
  | { ok: false; reason: "not_found" | "invalid"; message: string };

function failure(reason: "not_found" | "invalid", message: string): BankConnectionResult {
  return { ok: false, reason, message };
}

function describeBankFailure(provider: BankChargeProviderName, error: unknown): string {
  const described = getBankAdapter(provider).describeError(error);
  if (described) return described.message;
  console.error("[bank-connection] unexpected error", error);
  return "Não foi possível falar com o banco agora. Tente de novo em instantes.";
}

async function registerWebhook(connection: PaymentBankConnection, accessToken: string) {
  const webhookUrl = buildBankWebhookUrl(connection);
  if (!webhookUrl?.startsWith("https://")) {
    return {
      webhookRegisteredAt: null,
      lastErrorMessage: "O aviso de pagamento só é cadastrado com o ÓRBITA no endereço público (https). Fora de produção a baixa automática fica desligada.",
      lastErrorAt: new Date(),
    };
  }
  try {
    const credentials = readConnectionCredentials(connection);
    await getBankAdapter(connection.provider).registerPaymentWebhook(credentials, accessToken, webhookUrl);
    return { webhookRegisteredAt: new Date(), lastErrorMessage: null, lastErrorAt: null };
  } catch (error) {
    return {
      webhookRegisteredAt: null,
      lastErrorMessage: `O banco não aceitou o aviso de pagamento: ${describeBankFailure(connection.provider, error)}`,
      lastErrorAt: new Date(),
    };
  }
}

async function logBankActivity(params: {
  organizationId: string;
  actor: BankActor;
  action: string;
  actionLabel: string;
  accountId: string;
  accountName: string;
}) {
  await logActivity({
    organizationId: params.organizationId,
    userId: params.actor.id,
    userName: params.actor.name,
    userEmail: params.actor.email,
    appSlug: "payment",
    subAppSlug: "payment-accounts",
    featureKey: params.action,
    action: params.action,
    actionLabel: params.actionLabel,
    resource: params.accountName,
    resourceId: params.accountId,
  });
}

export interface SaveBankConnectionInput {
  accountId: string;
  provider: BankChargeProviderName;
  environment: "production" | "sandbox";
  /** Ausente ao atualizar: mantém o guardado. */
  clientId?: string;
  /** Ausente ao só trocar o certificado: mantém o secret guardado (RF-9). */
  clientSecret?: string;
  certificatePem?: string;
  privateKeyPem?: string;
  pixKey: string;
  accountNumber?: string | null;
}

export async function saveBankConnection(params: {
  organizationId: string;
  actor: BankActor;
  input: SaveBankConnectionInput;
}): Promise<BankConnectionResult> {
  const { organizationId, actor, input } = params;
  if (!hasSecretKey("BANK_SECRETS_KEY")) {
    return failure("invalid", "A conexão com bancos não está habilitada neste servidor (falta a BANK_SECRETS_KEY). Fale com o suporte.");
  }

  const account = await prisma.paymentBankAccount.findFirst({
    where: { id: input.accountId, organizationId, isActive: true },
    select: { id: true, name: true, bankConnection: true },
  });
  if (!account) return failure("not_found", "Conta bancária não encontrada.");

  const existing = account.bankConnection?.provider === input.provider ? account.bankConnection : null;
  const existingCredentials = existing ? readConnectionCredentials(existing) : null;
  const credentials: BankCredentials = {
    environment: input.environment,
    clientId: input.clientId?.trim() || existingCredentials?.clientId || "",
    clientSecret: input.clientSecret?.trim() || existingCredentials?.clientSecret || "",
    certificatePem: input.certificatePem?.trim() || existingCredentials?.certificatePem || null,
    privateKeyPem: input.privateKeyPem?.trim() || existingCredentials?.privateKeyPem || null,
    pixKey: normalizePixKey(input.pixKey),
    accountNumber: input.accountNumber?.replace(/\D/g, "") || null,
  };
  if (!credentials.clientId || !credentials.clientSecret) {
    return failure("invalid", "Informe o client_id e o client_secret da integração.");
  }

  const adapter = getBankAdapter(input.provider);
  let certificateValidTo: Date | null;
  let accessToken: string;
  let accessTokenExpiresAt: Date;
  let scopes: string[];
  try {
    certificateValidTo = adapter.inspectCredentials(credentials).certificateValidTo;
    const token = await adapter.requestAccessToken(credentials);
    accessToken = token.accessToken;
    accessTokenExpiresAt = token.expiresAt;
    scopes = token.scopes;
  } catch (error) {
    if (error instanceof BankConnectionError) return failure("invalid", error.message);
    return failure("invalid", describeBankFailure(input.provider, error));
  }

  const hasOtherChargeConnection = await prisma.paymentBankConnection.count({
    where: { organizationId, isDefaultForCharges: true, NOT: { accountId: account.id } },
  });
  const secretsData = {
    provider: input.provider,
    environment: credentials.environment,
    clientId: credentials.clientId,
    clientSecretEnc: encryptBankSecret(organizationId, credentials.clientSecret),
    certificateEnc: credentials.certificatePem ? encryptBankSecret(organizationId, credentials.certificatePem) : null,
    privateKeyEnc: credentials.privateKeyPem ? encryptBankSecret(organizationId, credentials.privateKeyPem) : null,
    certificateValidTo,
    certificateAlertDays: null,
    scopes: scopes.join(" "),
    pixKey: credentials.pixKey,
    accountNumber: credentials.accountNumber,
    accessTokenEnc: encryptBankSecret(organizationId, accessToken),
    accessTokenExpiresAt,
  };
  const saved = await prisma.paymentBankConnection.upsert({
    where: { accountId: account.id },
    create: {
      ...secretsData,
      organizationId,
      accountId: account.id,
      webhookToken: randomBytes(24).toString("hex"),
      isDefaultForCharges: hasOtherChargeConnection === 0,
      connectedById: actor.id,
    },
    update: secretsData,
  });

  const webhookState = await registerWebhook(saved, accessToken);
  const connection = await prisma.paymentBankConnection.update({ where: { id: saved.id }, data: webhookState });

  await logBankActivity({
    organizationId,
    actor,
    action: existing ? "payment.bank.connection_updated" : "payment.bank.connected",
    actionLabel: `${existing ? "Atualizou" : "Conectou"} a API do banco na conta "${account.name}"`,
    accountId: account.id,
    accountName: account.name,
  });

  return { ok: true, connection: toBankConnectionSummary(connection) };
}

async function findConnection(organizationId: string, connectionId: string) {
  return prisma.paymentBankConnection.findFirst({
    where: { id: connectionId, organizationId },
    include: { account: { select: { id: true, name: true } } },
  });
}

/** Pede um token novo, relê os escopos e tenta de novo o aviso de pagamento, se faltar. */
export async function testBankConnection(params: {
  organizationId: string;
  connectionId: string;
}): Promise<BankConnectionResult> {
  const connection = await findConnection(params.organizationId, params.connectionId);
  if (!connection) return failure("not_found", "Conexão não encontrada.");

  const credentials = readConnectionCredentials(connection);
  let token;
  try {
    token = await getBankAdapter(connection.provider).requestAccessToken(credentials);
  } catch (error) {
    const message = describeBankFailure(connection.provider, error);
    await prisma.paymentBankConnection.update({
      where: { id: connection.id },
      data: { lastErrorMessage: message, lastErrorAt: new Date() },
    });
    return failure("invalid", message);
  }

  const tokenData = {
    scopes: token.scopes.join(" "),
    accessTokenEnc: encryptBankSecret(connection.organizationId, token.accessToken),
    accessTokenExpiresAt: token.expiresAt,
  };
  const webhookState = await registerWebhook(connection, token.accessToken);
  const updated = await prisma.paymentBankConnection.update({
    where: { id: connection.id },
    data: { ...tokenData, ...webhookState },
  });
  return { ok: true, connection: toBankConnectionSummary(updated) };
}

/** RF-10: apaga os segredos e o token e tira o aviso de pagamento do banco, quando der. */
export async function disconnectBankConnection(params: {
  organizationId: string;
  actor: BankActor;
  connectionId: string;
}): Promise<{ ok: true } | { ok: false; reason: "not_found"; message: string }> {
  const connection = await findConnection(params.organizationId, params.connectionId);
  if (!connection) return { ok: false, reason: "not_found", message: "Conexão não encontrada." };

  // Antes de apagar: sem a conexão, ninguém mais cancela nem dá baixa nesses PIX.
  const { cancelled } = await cancelOpenBankPixOfConnection(connection.id);
  if (cancelled > 0) console.info("[bank-connection] open PIX cancelled on disconnect", { connectionId: connection.id, cancelled });

  if (connection.webhookRegisteredAt) {
    try {
      const bank = openConnectedBank(connection);
      await getBankAdapter(connection.provider).removePaymentWebhook(bank.credentials, await bank.getAccessToken());
    } catch (error) {
      console.warn("[bank-connection] webhook removal failed", describeBankFailure(connection.provider, error));
    }
  }

  await prisma.paymentBankConnection.delete({ where: { id: connection.id } });
  await logBankActivity({
    organizationId: params.organizationId,
    actor: params.actor,
    action: "payment.bank.disconnected",
    actionLabel: `Desconectou a API do banco da conta "${connection.account.name}"`,
    accountId: connection.account.id,
    accountName: connection.account.name,
  });
  return { ok: true };
}

/** RF-3: só uma conexão por empresa gera o PIX das cobranças. */
export async function setChargeConnection(params: {
  organizationId: string;
  actor: BankActor;
  connectionId: string;
  isDefaultForCharges: boolean;
}): Promise<BankConnectionResult> {
  const connection = await findConnection(params.organizationId, params.connectionId);
  if (!connection) return failure("not_found", "Conexão não encontrada.");

  const updated = await prisma.$transaction(async (tx) => {
    if (params.isDefaultForCharges) {
      await tx.paymentBankConnection.updateMany({
        where: { organizationId: params.organizationId, NOT: { id: connection.id } },
        data: { isDefaultForCharges: false },
      });
    }
    return tx.paymentBankConnection.update({
      where: { id: connection.id },
      data: { isDefaultForCharges: params.isDefaultForCharges },
    });
  });

  await logBankActivity({
    organizationId: params.organizationId,
    actor: params.actor,
    action: "payment.bank.charge_account_changed",
    actionLabel: params.isDefaultForCharges
      ? `Escolheu a conta "${connection.account.name}" para gerar o PIX das cobranças`
      : `Deixou de gerar o PIX das cobranças pela conta "${connection.account.name}"`,
    accountId: connection.account.id,
    accountName: connection.account.name,
  });
  return { ok: true, connection: toBankConnectionSummary(updated) };
}
