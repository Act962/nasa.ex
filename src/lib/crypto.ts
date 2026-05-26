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
const SCRYPT_SALT = "nasa-ai-secrets-v1";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.AI_SECRETS_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      "AI_SECRETS_KEY ausente ou muito curta — defina uma chave de pelo menos 16 chars no .env.local para criptografar API keys.",
    );
  }
  cachedKey = scryptSync(raw, SCRYPT_SALT, KEY_LEN);
  return cachedKey;
}

// Cifra um segredo. Retorna base64 no formato `iv:authTag:ciphertext`.
export function encryptSecret(plain: string): string {
  if (!plain) throw new Error("encryptSecret: input vazio");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
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

export function decryptSecret(cipherText: string): string {
  const [ivB64, tagB64, dataB64] = cipherText.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("decryptSecret: formato inválido");
  }
  const decipher = createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
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
