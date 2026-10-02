import "server-only";

/** Provedores que recusaram por falta de crédito, para o roteador pular por um tempo (spec 0055, RF-7 e D-3). */

const EXHAUSTION_WINDOW_MS = 30 * 60_000;
const PLATFORM_SCOPE = "platform";

const exhaustedUntilByKey = new Map<string, number>();

function toScopeKey(organizationId: string | null, provider: string): string {
  return `${organizationId ?? PLATFORM_SCOPE}:${provider}`;
}

/** `organizationId` nulo = chave da plataforma; preenchido = chave própria daquela empresa. */
export function markProviderExhausted(params: { organizationId: string | null; provider: string }) {
  exhaustedUntilByKey.set(toScopeKey(params.organizationId, params.provider), Date.now() + EXHAUSTION_WINDOW_MS);
}

export function isProviderExhausted(params: { organizationId: string | null; provider: string }): boolean {
  const scopeKey = toScopeKey(params.organizationId, params.provider);
  const exhaustedUntil = exhaustedUntilByKey.get(scopeKey);
  if (!exhaustedUntil) return false;
  if (Date.now() > exhaustedUntil) {
    exhaustedUntilByKey.delete(scopeKey);
    return false;
  }
  return true;
}

/** Lançamento novo de crédito: volta a tentar o provedor na hora (CB-5). */
export function clearProviderExhaustion(params: { organizationId: string | null; provider: string }) {
  exhaustedUntilByKey.delete(toScopeKey(params.organizationId, params.provider));
}
