import "server-only";
import prisma from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import type { AsaasEnv } from "@/lib/asaas";

export class CatalogPaymentNotConfiguredError extends Error {
  constructor() {
    super("A loja ainda não configurou a conta Asaas na integração NERP.");
    this.name = "CatalogPaymentNotConfiguredError";
  }
}

export function toAsaasEnv(value: string): AsaasEnv {
  return value === "sandbox" ? "sandbox" : "production";
}

export async function loadAsaasCredentials(organizationId: string) {
  const integration = await prisma.nerpCatalogIntegration.findUnique({
    where: { organizationId },
    select: { asaasApiKey: true, asaasEnv: true },
  });
  if (!integration?.asaasApiKey) throw new CatalogPaymentNotConfiguredError();
  return {
    apiKey: decryptSecret(integration.asaasApiKey),
    env: toAsaasEnv(integration.asaasEnv),
  };
}
