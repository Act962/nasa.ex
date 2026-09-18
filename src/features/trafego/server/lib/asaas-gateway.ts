import "server-only";
import prisma from "@/lib/prisma";
import type { AsaasEnv } from "@/lib/asaas";

/**
 * Credenciais do Asaas para o trafeGO. Ficam no `PaymentGatewayConfig`, que já
 * tem UI em /admin/payments — trocar chave ou girar o token do webhook não
 * precisa de deploy.
 */
export interface TrafegoAsaasGateway {
  id: string;
  secretKey: string;
  environment: AsaasEnv;
  /** Token do header `asaas-access-token`. Null = webhook recusa tudo. */
  authToken: string | null;
}

export async function loadTrafegoAsaasGateway(): Promise<TrafegoAsaasGateway | null> {
  const gateway = await prisma.paymentGatewayConfig.findFirst({
    where: { provider: "asaas", isActive: true },
    orderBy: { isDefault: "desc" },
    select: {
      id: true,
      secretKey: true,
      environment: true,
      webhookSecret: true,
    },
  });
  if (!gateway?.secretKey) return null;

  return {
    id: gateway.id,
    secretKey: gateway.secretKey,
    environment: gateway.environment === "sandbox" ? "sandbox" : "production",
    authToken: gateway.webhookSecret?.trim() || null,
  };
}

/**
 * Compara o token do header com o configurado, em tempo constante.
 *
 * Fail-closed de propósito: sem token configurado não há como distinguir o
 * Asaas de qualquer um que conheça a URL, e o handler credita dinheiro.
 */
export function isAsaasWebhookTokenValid(
  received: string | null,
  expected: string | null,
): boolean {
  if (!expected || !received) return false;
  if (received.length !== expected.length) return false;

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}
