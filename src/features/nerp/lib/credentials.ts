import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

// O secret HMAC da integração NERP autentica chamadas nos dois sentidos
// (Órbita → NERP e pedidos do catálogo NERP → Órbita), então fica cifrado em
// `PlatformIntegration.config.secretEnc`. Conexões antigas guardavam `secret`
// em claro; a leitura aceita as duas formas até a próxima reconexão.

export type StoredNerpConfig = {
  apiKey?: unknown;
  secret?: unknown;
  secretEnc?: unknown;
  nerpOrgId?: unknown;
  baseUrl?: unknown;
  scopes?: unknown;
  connectedAt?: unknown;
  consentByUserId?: unknown;
};

export function sealNerpSecret(secret: string): { secretEnc: string } {
  return { secretEnc: encryptSecret(secret) };
}

export function readNerpSecret(config: StoredNerpConfig | null): string | null {
  if (!config) return null;
  if (typeof config.secretEnc === "string" && config.secretEnc) {
    try {
      return decryptSecret(config.secretEnc);
    } catch (error) {
      console.error("[nerp/credentials] falha ao decifrar secret", error);
      return null;
    }
  }
  return typeof config.secret === "string" && config.secret ? config.secret : null;
}

export function readNerpScopes(config: StoredNerpConfig | null): string[] {
  return Array.isArray(config?.scopes)
    ? config.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];
}
