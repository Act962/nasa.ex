/**
 * Factory aberta a N providers (registry).
 *
 * **Por que registry e não enum**: adicionar uma 3ª API de WhatsApp amanhã
 * (Twilio, 360dialog, terceira não-oficial, etc.) NÃO pode exigir mexer no
 * core do chat — basta o novo adapter chamar `registerProvider("custom-v1", ...)`
 * de algum lugar do bundle e o factory já o conhece. É o padrão Open/Closed.
 *
 * **Side-effect de registro**: cada adapter (`adapters/uazapi/provider.ts`,
 * `adapters/meta-cloud/provider.ts`) registra a si mesmo ao ser importado.
 * O barrel `./index.ts` importa ambos, então quem importa
 * `@/features/tracking-chat/lib/providers` já recebe os dois prontos.
 */

import type {
  ProviderBuilder,
  ProviderConfig,
  ProviderId,
  WhatsAppChatProvider,
} from "./types";

const registry = new Map<ProviderId, ProviderBuilder>();

/**
 * Registra um builder para o `providerId`. Re-registrar com o mesmo id
 * sobrescreve — útil pra testes; em produção cada adapter chama uma vez.
 */
export function registerProvider(
  providerId: ProviderId,
  builder: ProviderBuilder,
): void {
  registry.set(providerId, builder);
}

/**
 * Lista os providers atualmente registrados — usado pela UI da Fase 4 pra
 * popular o seletor "qual provider este tracking usa".
 */
export function listRegisteredProviders(): ReadonlyArray<ProviderId> {
  return Array.from(registry.keys());
}

/** Útil em testes / hot-reload pra começar do zero. */
export function clearProviderRegistry(): void {
  registry.clear();
}

export class UnknownProviderError extends Error {
  constructor(providerId: string) {
    super(
      `WhatsApp provider "${providerId}" não está registrado. ` +
        `Registrados: [${Array.from(registry.keys()).join(", ") || "nenhum"}]`,
    );
    this.name = "UnknownProviderError";
  }
}

/**
 * Cria uma instância do provider a partir do `providerId` e da config dele.
 * O adapter é responsável por validar o shape da `config` que recebe (com
 * Zod, idealmente) — esta função só dispatcha.
 *
 * Lança `UnknownProviderError` se o id não foi registrado.
 */
export function createProvider(
  providerId: ProviderId,
  config: ProviderConfig,
): WhatsAppChatProvider {
  const builder = registry.get(providerId);
  if (!builder) throw new UnknownProviderError(String(providerId));
  return builder(config);
}
