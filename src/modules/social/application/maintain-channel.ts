import type { Channel } from "../domain/types";
import type { ChannelCapabilities, ContentPublisher, CredentialRenewer } from "../ports/content-publisher";
import type { ChannelRepository } from "../ports/repositories";

/** Cuidados periódicos de uma conta conectada (spec 0071): o que ela consegue fazer e a validade do token. */

export const CREDENTIAL_RENEWAL_WINDOW_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export const REJECTED_CREDENTIAL_MESSAGE = "A rede recusou o token desta conta. Troque a credencial para voltar a publicar e responder.";

export type RefreshCapabilitiesDeps = {
  channels: ChannelRepository;
  createPublisher: (channel: Channel) => ContentPublisher;
};

export type RefreshCapabilitiesResult =
  | { status: "skipped" }
  | { status: "needs-reconnect" }
  | { status: "checked"; capabilities: Pick<ChannelCapabilities, "canPublish" | "canReadInsights"> };

/**
 * Confere na rede o que a credencial permite e guarda na conta. Credencial
 * recusada vira "precisa reconectar" aqui, antes de um post agendado falhar.
 */
export async function refreshChannelCapabilities(channelId: string, deps: RefreshCapabilitiesDeps): Promise<RefreshCapabilitiesResult> {
  const channel = await deps.channels.findWithCredentialsById(channelId);
  if (!channel || channel.status === "DISABLED") return { status: "skipped" };

  const capabilities = await deps.createPublisher(channel).checkCapabilities();
  if (capabilities.isCredentialRejected) {
    await deps.channels.markNeedsReconnect(channel.id, REJECTED_CREDENTIAL_MESSAGE);
    return { status: "needs-reconnect" };
  }

  const checkedCapabilities = { canPublish: capabilities.canPublish, canReadInsights: capabilities.canReadInsights };
  await deps.channels.saveCapabilities(channel.id, checkedCapabilities);
  return { status: "checked", capabilities: checkedCapabilities };
}

export type RenewCredentialsDeps = {
  channels: ChannelRepository;
  renewer: CredentialRenewer;
  now: () => Date;
};

export type RenewCredentialsResult =
  | { status: "skipped"; reason: "not-found" | "disabled" | "not-renewable" | "not-due" }
  | { status: "renewed"; expiresAt: Date }
  | { status: "failed"; error: string }
  | { status: "needs-reconnect" };

export function isCredentialRenewalDue(credentialsExpiresAt: Date | null, now: Date) {
  if (!credentialsExpiresAt) return true;
  return credentialsExpiresAt.getTime() - now.getTime() <= CREDENTIAL_RENEWAL_WINDOW_DAYS * DAY_MS;
}

/**
 * Renova o token do app do Instagram antes de vencer (spec 0071, D-4).
 *
 * Com a validade ainda desconhecida a falha não derruba a conta: a rede recusa
 * renovar token com menos de 24h, e esse caso não pode virar "precisa reconectar".
 */
export async function renewChannelCredentials(channelId: string, deps: RenewCredentialsDeps): Promise<RenewCredentialsResult> {
  const summary = await deps.channels.findById(channelId);
  if (!summary) return { status: "skipped", reason: "not-found" };
  if (summary.status === "DISABLED") return { status: "skipped", reason: "disabled" };
  // O token de página da conexão da Meta não vence por tempo.
  if (summary.authMode === "META_LOGIN") return { status: "skipped", reason: "not-renewable" };
  if (!isCredentialRenewalDue(summary.credentialsExpiresAt, deps.now())) return { status: "skipped", reason: "not-due" };

  const channel = await deps.channels.findWithCredentialsById(channelId);
  if (!channel) return { status: "skipped", reason: "not-found" };

  const renewal = await deps.renewer.renew(channel.credentials.accessToken);
  if (renewal.ok) {
    await deps.channels.saveRenewedCredentials(channel.id, renewal.accessToken, renewal.expiresAt);
    return { status: "renewed", expiresAt: renewal.expiresAt };
  }

  const isExpiryKnown = summary.credentialsExpiresAt !== null;
  if (renewal.isCredentialRejected && isExpiryKnown) {
    await deps.channels.markNeedsReconnect(channel.id, REJECTED_CREDENTIAL_MESSAGE);
    return { status: "needs-reconnect" };
  }
  return { status: "failed", error: renewal.error };
}
