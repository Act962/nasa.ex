import "server-only";
import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { hasSecretKey } from "@/lib/crypto";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { describeBankPermissions, normalizePixKey } from "@/features/payment/lib/bank-providers";
import type { PaymentBankConnection } from "@/generated/prisma/client";
import { getBankAdapter } from "./bank-adapters";
import {
  buildBankWebhookUrl,
  encryptBankSecret,
  hasBoletoPermission,
  openConnectedBank,
  readConnectionCredentials,
  toBankConnectionSummary,
  type BankConnectionSummary,
} from "./connection-store";
import { cancelOpenBankChargesOfConnection } from "./charge-pix";
import {
  BankConnectionError,
  type BankAccessToken,
  type BankChargeProviderName,
  type BankCredentials,
  type BankPermissionReport,
} from "./ports";

// Conectar, testar, desconectar e escolher a conta das cobranças (spec 0130, RF-1, RF-3, RF-10),
// com as permissões conferidas na API e a escolha entre PIX e boleto (spec 0133).
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

async function registerBoletoWebhook(connection: PaymentBankConnection, accessToken: string) {
  const adapter = getBankAdapter(connection.provider);
  const webhookUrl = buildBankWebhookUrl(connection);
  if (!adapter.registerBoletoWebhook || !webhookUrl?.startsWith("https://")) return { boletoWebhookRegisteredAt: null };
  try {
    await adapter.registerBoletoWebhook(readConnectionCredentials(connection), accessToken, webhookUrl);
    return { boletoWebhookRegisteredAt: new Date() };
  } catch (error) {
    return {
      boletoWebhookRegisteredAt: null,
      lastErrorMessage: `O banco não aceitou o aviso de pagamento do boleto: ${describeBankFailure(connection.provider, error)}`,
      lastErrorAt: new Date(),
    };
  }
}

/**
 * Valida as credenciais, confere as permissões chamando a API e devolve o token de trabalho.
 * Quatro tokens no total, dentro dos cinco por minuto do Inter.
 */
async function verifyBankAccess(
  provider: BankChargeProviderName,
  credentials: BankCredentials,
): Promise<{ ok: true; report: BankPermissionReport; token: BankAccessToken } | { ok: false; message: string }> {
  const adapter = getBankAdapter(provider);
  try {
    await adapter.requestAccessToken(credentials);
    const report = await adapter.checkPermissions(credentials);
    if (report.missingForPix.length > 0) {
      return {
        ok: false,
        message: `A integração no banco não tem as permissões que o PIX precisa: ${describeBankPermissions(report.missingForPix)}. Marque-as na integração e tente de novo.`,
      };
    }
    const includeBoleto = report.missingForBoleto !== null && report.missingForBoleto.length === 0;
    const token = await adapter.requestAccessToken(credentials, { includeBoleto });
    return { ok: true, report, token };
  } catch (error) {
    if (error instanceof BankConnectionError) return { ok: false, message: error.message };
    return { ok: false, message: describeBankFailure(provider, error) };
  }
}

function toPermissionData(report: BankPermissionReport) {
  return { scopes: [...report.granted, ...report.moneyMoving].join(" "), permissionsCheckedAt: new Date() };
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

  let certificateValidTo: Date | null;
  try {
    certificateValidTo = getBankAdapter(input.provider).inspectCredentials(credentials).certificateValidTo;
  } catch (error) {
    if (error instanceof BankConnectionError) return failure("invalid", error.message);
    return failure("invalid", describeBankFailure(input.provider, error));
  }
  const access = await verifyBankAccess(input.provider, credentials);
  if (!access.ok) return failure("invalid", access.message);

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
    ...toPermissionData(access.report),
    pixKey: credentials.pixKey,
    accountNumber: credentials.accountNumber,
    accessTokenEnc: encryptBankSecret(organizationId, access.token.accessToken),
    accessTokenExpiresAt: access.token.expiresAt,
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

  const webhookState = await registerWebhook(saved, access.token.accessToken);
  const boletoWebhookState =
    saved.chargeMethod === "BOLETO_PIX" && hasBoletoPermission(saved)
      ? await registerBoletoWebhook(saved, access.token.accessToken)
      : {};
  const connection = await prisma.paymentBankConnection.update({
    where: { id: saved.id },
    data: { ...webhookState, ...boletoWebhookState },
  });

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

/** Confere credenciais e permissões de novo e tenta outra vez os avisos de pagamento que faltam. */
export async function testBankConnection(params: {
  organizationId: string;
  connectionId: string;
}): Promise<BankConnectionResult> {
  const connection = await findConnection(params.organizationId, params.connectionId);
  if (!connection) return failure("not_found", "Conexão não encontrada.");

  const access = await verifyBankAccess(connection.provider, readConnectionCredentials(connection));
  if (!access.ok) {
    await prisma.paymentBankConnection.update({
      where: { id: connection.id },
      data: { lastErrorMessage: access.message, lastErrorAt: new Date() },
    });
    return failure("invalid", access.message);
  }

  const checked = await prisma.paymentBankConnection.update({
    where: { id: connection.id },
    data: {
      ...toPermissionData(access.report),
      accessTokenEnc: encryptBankSecret(connection.organizationId, access.token.accessToken),
      accessTokenExpiresAt: access.token.expiresAt,
    },
  });
  const webhookState = await registerWebhook(checked, access.token.accessToken);
  const boletoWebhookState =
    checked.chargeMethod === "BOLETO_PIX" && hasBoletoPermission(checked)
      ? await registerBoletoWebhook(checked, access.token.accessToken)
      : {};
  const updated = await prisma.paymentBankConnection.update({
    where: { id: connection.id },
    data: { ...webhookState, ...boletoWebhookState },
  });
  return { ok: true, connection: toBankConnectionSummary(updated) };
}

export interface BankChargeMethodInput {
  chargeMethod: "PIX" | "BOLETO_PIX";
  finePercent: number | null;
  interestMonthlyPercent: number | null;
  discountPercent: number | null;
  discountDays: number | null;
}

function toBps(percent: number | null): number | null {
  return percent === null || percent <= 0 ? null : Math.round(percent * 100);
}

/** Spec 0133, RF-1 e RF-2: PIX ou boleto com PIX, e multa, juros e desconto do boleto. */
export async function setBankChargeMethod(params: {
  organizationId: string;
  actor: BankActor;
  connectionId: string;
  input: BankChargeMethodInput;
}): Promise<BankConnectionResult> {
  const connection = await findConnection(params.organizationId, params.connectionId);
  if (!connection) return failure("not_found", "Conexão não encontrada.");
  const { input } = params;

  if (input.chargeMethod === "BOLETO_PIX" && !hasBoletoPermission(connection)) {
    const adapter = getBankAdapter(connection.provider);
    if (!adapter.permissionScopes.boleto) return failure("invalid", "Este banco não emite boleto pela API.");
    return failure(
      "invalid",
      connection.permissionsCheckedAt
        ? `A integração no banco não tem as permissões do boleto: ${describeBankPermissions(adapter.permissionScopes.boleto)}. Marque-as na integração e clique em "Testar conexão".`
        : 'As permissões desta conexão ainda não foram conferidas. Clique em "Testar conexão" e tente de novo.',
    );
  }
  const hasDiscount = toBps(input.discountPercent) !== null;
  const updated = await prisma.paymentBankConnection.update({
    where: { id: connection.id },
    data: {
      chargeMethod: input.chargeMethod,
      boletoFineBps: toBps(input.finePercent),
      boletoInterestMonthlyBps: toBps(input.interestMonthlyPercent),
      boletoDiscountBps: toBps(input.discountPercent),
      boletoDiscountDays: hasDiscount ? Math.max(input.discountDays ?? 0, 0) : null,
    },
  });

  let final = updated;
  if (input.chargeMethod === "BOLETO_PIX" && !updated.boletoWebhookRegisteredAt) {
    const boletoWebhookState = await registerBoletoWebhook(updated, await openConnectedBank(updated).getAccessToken());
    final = await prisma.paymentBankConnection.update({ where: { id: updated.id }, data: boletoWebhookState });
  }

  await logBankActivity({
    organizationId: params.organizationId,
    actor: params.actor,
    action: "payment.bank.charge_method_changed",
    actionLabel:
      input.chargeMethod === "BOLETO_PIX"
        ? `Passou a cobrar com boleto e PIX pela conta "${connection.account.name}"`
        : `Passou a cobrar só com PIX pela conta "${connection.account.name}"`,
    accountId: connection.account.id,
    accountName: connection.account.name,
  });
  return { ok: true, connection: toBankConnectionSummary(final) };
}

/** RF-10: apaga os segredos e o token e tira o aviso de pagamento do banco, quando der. */
export async function disconnectBankConnection(params: {
  organizationId: string;
  actor: BankActor;
  connectionId: string;
}): Promise<{ ok: true } | { ok: false; reason: "not_found"; message: string }> {
  const connection = await findConnection(params.organizationId, params.connectionId);
  if (!connection) return { ok: false, reason: "not_found", message: "Conexão não encontrada." };

  // Antes de apagar: sem a conexão, ninguém mais cancela nem dá baixa nesses PIX e boletos.
  const { cancelled } = await cancelOpenBankChargesOfConnection(connection.id);
  if (cancelled > 0) console.info("[bank-connection] open charges cancelled on disconnect", { connectionId: connection.id, cancelled });

  const adapter = getBankAdapter(connection.provider);
  if (connection.webhookRegisteredAt || connection.boletoWebhookRegisteredAt) {
    try {
      const bank = openConnectedBank(connection);
      const accessToken = await bank.getAccessToken();
      if (connection.webhookRegisteredAt) await adapter.removePaymentWebhook(bank.credentials, accessToken);
      if (connection.boletoWebhookRegisteredAt) await adapter.removeBoletoWebhook?.(bank.credentials, accessToken);
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
