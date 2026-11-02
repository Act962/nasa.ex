import "server-only";

import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";

/** Chaves de IA dos Satélites: cifradas no banco e nunca devolvidas ao navegador (spec 0053, RF-7..RF-9). */

export const AI_KEY_PLATFORMS = ["OPENAI", "ANTHROPIC", "GEMINI"] as const;

type IntegrationConfig = Record<string, unknown> | null | undefined;

const ENCRYPTED_SECRET_PATTERN = /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

export function isAiKeyPlatform(platform: string): boolean {
  return (AI_KEY_PLATFORMS as readonly string[]).includes(platform);
}

/**
 * Plataformas cujo `apiKey` é segredo e por isso é cifrado e mascarado. Inclui o Hugging Face, que
 * ficava em texto puro e voltava inteiro para o navegador (spec 0093, etapa 0). Lista separada de
 * `AI_KEY_PLATFORMS`, que continua sendo só "os três provedores que o seletor de IA conhece".
 */
const SEALED_KEY_PLATFORMS: readonly string[] = [...AI_KEY_PLATFORMS, "HUGGING_FACE"];

export function isSealedKeyPlatform(platform: string): boolean {
  return SEALED_KEY_PLATFORMS.includes(platform);
}

function isEncryptedSecret(value: string): boolean {
  return ENCRYPTED_SECRET_PATTERN.test(value);
}

function readSealedField(config: IntegrationConfig, field: string): string | null {
  const storedValue = config?.[field];
  if (typeof storedValue !== "string" || storedValue.length === 0) return null;
  if (!isEncryptedSecret(storedValue)) return storedValue;
  try {
    return decryptSecret(storedValue);
  } catch (decryptError) {
    console.warn(`[integrations] segredo "${field}" não pôde ser decifrado:`, decryptError);
    return null;
  }
}

/** Chave pronta para uso. Aceita texto puro legado, gravado antes da cifragem (RNF-1). */
export function readIntegrationApiKey(config: IntegrationConfig): string | null {
  return readSealedField(config, "apiKey");
}

// ─── Meta (spec 0122, RF-4..RF-6) ──────────────────────────────────────────

const META_SECRET_FIELDS = ["accessToken", "appSecret"] as const;
/** Chaves que só o servidor grava: o formulário nunca as define. */
const META_SERVER_ONLY_FIELDS = ["connectionCheck", "managedBy"] as const;
/** Segredos legados do OAuth antigo que também não podem ir ao navegador. */
const META_LEGACY_SECRET_FIELDS = ["page_access_token", "access_token"] as const;

export const META_MANAGED_BY_ORBITA = "ORBITA";

/** Token da Meta pronto para uso; aceita o texto puro gravado antes da spec 0122. */
export function readMetaAccessToken(config: IntegrationConfig): string | null {
  return readSealedField(config, "accessToken");
}

export function readMetaAppSecret(config: IntegrationConfig): string | null {
  return readSealedField(config, "appSecret");
}

export function isMetaManagedByOrbita(config: IntegrationConfig): boolean {
  return config?.managedBy === META_MANAGED_BY_ORBITA;
}

export function sealMetaSecret(plainValue: string): { sealed: string; last4: string } {
  return { sealed: encryptSecret(plainValue), last4: last4(plainValue) };
}

/**
 * Config da META que vai para o banco. Mescla com a atual (o formulário manual
 * não pode apagar o que o OAuth e o "Testar conexão" gravaram), cifra os
 * segredos e descarta chaves que só o servidor define.
 */
export function sealMetaIntegrationConfig(
  incomingConfig: Record<string, string>,
  currentConfig: IntegrationConfig,
  options: { canSetManagedBy: boolean },
): Record<string, unknown> {
  const editableIncoming = Object.fromEntries(
    Object.entries(incomingConfig).filter(
      ([key]) =>
        !(META_SECRET_FIELDS as readonly string[]).includes(key) &&
        !(META_SERVER_ONLY_FIELDS as readonly string[]).includes(key),
    ),
  );
  const sealedConfig: Record<string, unknown> = { ...(currentConfig ?? {}), ...editableIncoming };

  for (const field of META_SECRET_FIELDS) {
    const incomingValue = incomingConfig[field]?.trim() ?? "";
    const currentValue = readSealedField(currentConfig, field);
    const plainValue = incomingValue || currentValue;
    if (!plainValue) {
      delete sealedConfig[field];
      delete sealedConfig[`${field}Last4`];
      continue;
    }
    const { sealed, last4: valueLast4 } = sealMetaSecret(plainValue);
    sealedConfig[field] = sealed;
    sealedConfig[`${field}Last4`] = valueLast4;
  }

  if (options.canSetManagedBy && "managedBy" in incomingConfig) {
    if (incomingConfig.managedBy === META_MANAGED_BY_ORBITA) sealedConfig.managedBy = META_MANAGED_BY_ORBITA;
    else delete sealedConfig.managedBy;
  }

  const hasCredentialChanged =
    Boolean(incomingConfig.accessToken?.trim()) ||
    (typeof incomingConfig.adAccountId === "string" && incomingConfig.adAccountId !== currentConfig?.adAccountId);
  if (hasCredentialChanged) delete sealedConfig.connectionCheck;

  return sealedConfig;
}

/** Config da META que vai para o navegador: sem nenhum segredo. */
export function maskMetaIntegrationConfig(config: IntegrationConfig): IntegrationConfig {
  if (!config) return config;
  const maskedConfig: Record<string, unknown> = { ...config };
  for (const field of META_SECRET_FIELDS) {
    const storedValue = config[field];
    const hasStoredValue = typeof storedValue === "string" && storedValue.length > 0;
    const storedLast4 = config[`${field}Last4`];
    maskedConfig[field] = "";
    maskedConfig[`${field}Configured`] = hasStoredValue;
    maskedConfig[`${field}Last4`] =
      typeof storedLast4 === "string" && storedLast4
        ? storedLast4
        : hasStoredValue && !isEncryptedSecret(storedValue)
          ? last4(storedValue)
          : "";
  }
  for (const field of META_LEGACY_SECRET_FIELDS) {
    if (field in maskedConfig) maskedConfig[field] = "";
  }
  return maskedConfig;
}

/** Config que vai para o banco: cifra a chave nova; campo vazio em edição mantém a atual (CA-7). */
export function sealIntegrationConfig(
  platform: string,
  incomingConfig: Record<string, string>,
  currentConfig: IntegrationConfig,
): Record<string, string> {
  if (!isSealedKeyPlatform(platform)) return incomingConfig;

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
  if (platform === "META") return maskMetaIntegrationConfig(config);
  if (!isSealedKeyPlatform(platform) || !config) return config;
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
