import "server-only";
import type { AsaasEnv } from "@/lib/asaas";

/**
 * Credenciais do Asaas para o trafeGO, lidas do ambiente.
 *
 * Ficam no `.env` e não no banco de propósito: credencial de pagamento
 * guardada em linha editável pela interface é credencial que ninguém audita, e
 * o ambiente dela passa a depender de um campo que alguém pode trocar sem
 * querer. No `.env`, dev e produção são arquivos diferentes por construção.
 *
 * Variáveis:
 *   ASAAS_API_KEY        chave da API. Ausente = PIX volta ao fluxo manual.
 *   ASAAS_ENV            "sandbox" (padrão) | "production"
 *   ASAAS_WEBHOOK_TOKEN  header `asaas-access-token`. Ausente = webhook recusa
 *                        tudo. Nunca use a chave de API aqui.
 */
export interface TrafegoAsaasGateway {
  secretKey: string;
  environment: AsaasEnv;
  /** Token do header `asaas-access-token`. Null = webhook recusa tudo. */
  authToken: string | null;
}

/**
 * O padrão é `sandbox`. Errar para o lado do sandbox não move dinheiro de
 * ninguém; errar para o lado de produção, sim.
 */
function resolveEnvironment(): AsaasEnv {
  return process.env.ASAAS_ENV?.trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

export function loadTrafegoAsaasGateway(): TrafegoAsaasGateway | null {
  const secretKey = process.env.ASAAS_API_KEY?.trim();
  if (!secretKey) return null;

  return {
    secretKey,
    environment: resolveEnvironment(),
    authToken: process.env.ASAAS_WEBHOOK_TOKEN?.trim() || null,
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
