import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { InvalidCredentialsError } from "../domain/errors";
import type { ChannelCredentials } from "../domain/types";
import { channelCredentialsSchema } from "./schemas";

/**
 * As credenciais viajam como UM blob cifrado, porque o shape muda por provider
 * (spec 0024 D-8). O preço é não poder consultar por campo cifrado — daí o
 * roteamento do webhook por `webhookPathToken` (D-11).
 */
export function encryptCredentials(credentials: ChannelCredentials): string {
  const parsed = channelCredentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    throw new InvalidCredentialsError();
  }
  return encryptSecret(JSON.stringify(parsed.data));
}

export function decryptCredentials(ciphertext: string): ChannelCredentials {
  let raw: unknown;
  try {
    raw = JSON.parse(decryptSecret(ciphertext));
  } catch {
    throw new InvalidCredentialsError(
      "Não foi possível decifrar as credenciais da conexão. Se a AI_SECRETS_KEY mudou, reconecte a conta.",
    );
  }

  const parsed = channelCredentialsSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidCredentialsError();
  return parsed.data;
}
