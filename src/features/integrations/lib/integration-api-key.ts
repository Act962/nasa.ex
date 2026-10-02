import "server-only";

import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";

/** Chaves de IA dos Satélites: cifradas no banco e nunca devolvidas ao navegador (spec 0053, RF-7..RF-9). */

export const AI_KEY_PLATFORMS = ["OPENAI", "ANTHROPIC", "GEMINI"] as const;

type IntegrationConfig = Record<string, unknown> | null | undefined;

const ENCRYPTED_SECRET_PATTERN = /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

export function isAiKeyPlatform(platform: string): boolean {
  return (AI_KEY_PLATFORMS as readonly string[]).includes(platform);
}

function isEncryptedSecret(value: string): boolean {
  return ENCRYPTED_SECRET_PATTERN.test(value);
}

/** Chave pronta para uso. Aceita texto puro legado, gravado antes da cifragem (RNF-1). */
export function readIntegrationApiKey(config: IntegrationConfig): string | null {
  const storedKey = config?.apiKey;
  if (typeof storedKey !== "string" || storedKey.length === 0) return null;
  if (!isEncryptedSecret(storedKey)) return storedKey;
  try {
    return decryptSecret(storedKey);
  } catch (decryptError) {
    console.warn("[integrations] chave de IA não pôde ser decifrada:", decryptError);
    return null;
  }
}

/** Config que vai para o banco: cifra a chave nova; campo vazio em edição mantém a atual (CA-7). */
export function sealIntegrationConfig(
  platform: string,
  incomingConfig: Record<string, string>,
  currentConfig: IntegrationConfig,
): Record<string, string> {
  if (!isAiKeyPlatform(platform)) return incomingConfig;

  const incomingKey = incomingConfig.apiKey?.trim() ?? "";
  if (!incomingKey) {
    const currentKey = typeof currentConfig?.apiKey === "string" ? currentConfig.apiKey : "";
    const currentLast4 = typeof currentConfig?.apiKeyLast4 === "string" ? currentConfig.apiKeyLast4 : "";
    return { ...incomingConfig, apiKey: currentKey, apiKeyLast4: currentLast4 };
  }
  return { ...incomingConfig, apiKey: encryptSecret(incomingKey), apiKeyLast4: last4(incomingKey) };
}

/** Config que vai para o navegador: sem a chave, só se ela existe e os 4 últimos dígitos. */
export function maskIntegrationConfig(platform: string, config: IntegrationConfig): IntegrationConfig {
  if (!isAiKeyPlatform(platform) || !config) return config;
  const storedKey = config.apiKey;
  const hasStoredKey = typeof storedKey === "string" && storedKey.length > 0;
  const keyLast4 =
    typeof config.apiKeyLast4 === "string" && config.apiKeyLast4
      ? config.apiKeyLast4
      : hasStoredKey && !isEncryptedSecret(storedKey)
        ? last4(storedKey)
        : "";
  return { ...config, apiKey: "", apiKeyConfigured: hasStoredKey, apiKeyLast4: keyLast4 };
}
