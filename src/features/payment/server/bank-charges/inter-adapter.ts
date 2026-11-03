import "server-only";
import { InterApiError, requestInterToken } from "@/http/inter/client";
import { inspectInterCertificate } from "@/http/inter/certificate";
import { INTER_CHARGE_SCOPES, findMoneyMovingScopes } from "@/http/inter/scopes";
import type { InterCallContext } from "@/http/inter/types";
import { deleteInterPixWebhook, registerInterPixWebhook } from "@/http/inter/webhook";
import { createInterChargeProvider } from "./inter-charge-provider";
import { BankConnectionError, type BankAdapter, type BankCredentials } from "./ports";

// O Inter na porta `BankAdapter`: mTLS com `.crt`/`.key`, token de 60 min e webhook por chave PIX.

const CREDENTIAL_ERROR_STATUSES = new Set([401, 403, 406]);

function requireMtls(credentials: BankCredentials) {
  if (!credentials.certificatePem || !credentials.privateKeyPem) {
    throw new BankConnectionError("Envie o certificado (.crt) e a chave (.key) da integração do Inter.", true);
  }
  return {
    env: credentials.environment,
    certificatePem: credentials.certificatePem,
    privateKeyPem: credentials.privateKeyPem,
  };
}

function buildCallContext(credentials: BankCredentials, accessToken: string): InterCallContext {
  return { ...requireMtls(credentials), accountNumber: credentials.accountNumber, accessToken };
}

export const interBankAdapter: BankAdapter = {
  provider: "INTER",

  inspectCredentials(credentials) {
    const mtls = requireMtls(credentials);
    const inspected = inspectInterCertificate(mtls.certificatePem, mtls.privateKeyPem);
    if (!inspected.ok) throw new BankConnectionError(inspected.reason, true);
    return { certificateValidTo: inspected.info.validTo };
  },

  async requestAccessToken(credentials) {
    const token = await requestInterToken(
      { ...requireMtls(credentials), clientId: credentials.clientId, clientSecret: credentials.clientSecret },
      INTER_CHARGE_SCOPES,
    );
    return {
      accessToken: token.access_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      scopes: token.scope.split(" ").filter(Boolean),
    };
  },

  findMoneyMovingScopes,

  createChargeProvider(credentials, getAccessToken) {
    return createInterChargeProvider({
      ...requireMtls(credentials),
      pixKey: credentials.pixKey,
      accountNumber: credentials.accountNumber,
      getAccessToken,
    });
  },

  async registerPaymentWebhook(credentials, accessToken, webhookUrl) {
    await registerInterPixWebhook(buildCallContext(credentials, accessToken), credentials.pixKey, webhookUrl);
  },

  async removePaymentWebhook(credentials, accessToken) {
    await deleteInterPixWebhook(buildCallContext(credentials, accessToken), credentials.pixKey);
  },

  describeError(error) {
    if (error instanceof BankConnectionError) {
      return { message: error.message, isCredentialProblem: error.isCredentialProblem };
    }
    if (error instanceof InterApiError) {
      return { message: error.message, isCredentialProblem: CREDENTIAL_ERROR_STATUSES.has(error.status) };
    }
    return null;
  },
};
