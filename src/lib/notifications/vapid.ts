import "server-only";

/**
 * Credenciais VAPID. A privada nunca sai do servidor — só a pública tem
 * prefixo `NEXT_PUBLIC_` e vai no bundle (spec 0022, D-6).
 *
 * Gerar um par novo: `npx web-push generate-vapid-keys`.
 */
export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  /** `mailto:` ou URL de contato exigido pelo protocolo. */
  subject: string;
}

export function loadVapidConfig(): VapidConfig | null {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey?.trim() || !privateKey?.trim()) return null;

  return {
    publicKey: publicKey.trim(),
    privateKey: privateKey.trim(),
    subject: process.env.VAPID_SUBJECT?.trim() || "mailto:suporte@nasaex.com",
  };
}
