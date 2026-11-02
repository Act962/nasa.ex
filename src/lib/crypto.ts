import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;

// Cada chave tem o próprio sal e tamanho mínimo: credencial de banco não cai junto se a
// chave das API keys de IA vazar ou for trocada (spec 0130, D-7).
const SECRET_KEYS = {
  AI_SECRETS_KEY: { salt: "nasa-ai-secrets-v1", minLength: 16 },
  BANK_SECRETS_KEY: { salt: "nasa-bank-secrets-v1", minLength: 32 },
} as const;

export type SecretKeyName = keyof typeof SECRET_KEYS;

export interface SecretOptions {
  keyName?: SecretKeyName;
  /** Dado adicional autenticado: o texto cifrado só abre com o mesmo valor (ex.: id da empresa). */
  additionalData?: string;
}

const cachedKeys = new Map<SecretKeyName, Buffer>();

export function hasSecretKey(keyName: SecretKeyName): boolean {
  const raw = process.env[keyName];
  return Boolean(raw && raw.length >= SECRET_KEYS[keyName].minLength);
}

function getKey(keyName: SecretKeyName): Buffer {
  const cached = cachedKeys.get(keyName);
  if (cached) return cached;
  const { salt, minLength } = SECRET_KEYS[keyName];
  const raw = process.env[keyName];
  if (!raw || raw.length < minLength) {
    throw new Error(
      `${keyName} ausente ou muito curta — defina uma chave de pelo menos ${minLength} chars no .env.local.`,
    );
  }
  const key = scryptSync(raw, salt, KEY_LEN);
  cachedKeys.set(keyName, key);
  return key;
}

// Cifra um segredo. Retorna base64 no formato `iv:authTag:ciphertext`.
export function encryptSecret(plain: string, options: SecretOptions = {}): string {
  if (!plain) throw new Error("encryptSecret: input vazio");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(options.keyName ?? "AI_SECRETS_KEY"), iv);
  if (options.additionalData) cipher.setAAD(Buffer.from(options.additionalData, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(cipherText: string, options: SecretOptions = {}): string {
  const [ivB64, tagB64, dataB64] = cipherText.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("decryptSecret: formato inválido");
  }
  const decipher = createDecipheriv(
    ALGO,
    getKey(options.keyName ?? "AI_SECRETS_KEY"),
    Buffer.from(ivB64, "base64"),
  );
  if (options.additionalData) decipher.setAAD(Buffer.from(options.additionalData, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

export function last4(value: string): string {
  return value.slice(-4);
}
