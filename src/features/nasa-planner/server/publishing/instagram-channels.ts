import "server-only";
import { createContentPublisher, socialRepositoriesForOrganization } from "@/modules/social";
import type { ContentPublisher } from "@/modules/social/ports/content-publisher";
import type { ChannelSummary } from "@/modules/social/ports/repositories";

/** Contas do Instagram do Planner: as conectadas nos Satélites, e só elas (spec 0071). */

export class PublishAccountUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishAccountUnavailableError";
  }
}

export const DISABLED_ACCOUNT_MESSAGE = "A conta do Instagram deste post está desativada nos Satélites.";
export const MISSING_ACCOUNT_MESSAGE = "Escolha a conta do Instagram deste post. A conta anterior não está mais conectada nos Satélites.";
export const CHOOSE_ACCOUNT_MESSAGE = "Este cliente tem mais de uma conta do Instagram. Escolha em qual o post vai sair.";
export const NO_ACCOUNT_MESSAGE = "Nenhuma conta do Instagram conectada para este cliente. Conecte nos Satélites.";
export const CANNOT_PUBLISH_MESSAGE = "Esta conta do Instagram não tem permissão de publicar. Libere a permissão no app da Meta e troque a credencial nos Satélites.";

export type InstagramTargetResolution =
  | { ok: true; channelId: string; externalAccountId: string }
  | { ok: false; problem: string };

/** Nunca escolhe sozinho entre várias contas (spec 0071, CB-3). */
export function pickInstagramChannel(channels: ChannelSummary[], requestedExternalId: string | null): InstagramTargetResolution {
  if (requestedExternalId) {
    const requested = channels.find((channel) => channel.externalAccountId === requestedExternalId);
    if (!requested) return { ok: false, problem: channels.length > 0 ? MISSING_ACCOUNT_MESSAGE : NO_ACCOUNT_MESSAGE };
    if (requested.status === "DISABLED") return { ok: false, problem: DISABLED_ACCOUNT_MESSAGE };
    if (requested.canPublish === false) return { ok: false, problem: CANNOT_PUBLISH_MESSAGE };
    return { ok: true, channelId: requested.id, externalAccountId: requested.externalAccountId };
  }
  const usableChannels = channels.filter((channel) => channel.status !== "DISABLED");
  if (usableChannels.length === 0) return { ok: false, problem: NO_ACCOUNT_MESSAGE };
  if (usableChannels.length > 1) return { ok: false, problem: CHOOSE_ACCOUNT_MESSAGE };
  const [onlyChannel] = usableChannels;
  if (onlyChannel.canPublish === false) return { ok: false, problem: CANNOT_PUBLISH_MESSAGE };
  return { ok: true, channelId: onlyChannel.id, externalAccountId: onlyChannel.externalAccountId };
}

export async function resolveInstagramTarget(organizationId: string, requestedExternalId: string | null) {
  const channels = await socialRepositoriesForOrganization(organizationId).channels.listForTenant("INSTAGRAM");
  return pickInstagramChannel(channels, requestedExternalId);
}

/** Conta que um post novo usa quando ninguém escolheu: só existe se a empresa tem uma única conta ativa. */
export async function findDefaultInstagramAccountId(organizationId: string): Promise<string | null> {
  const resolution = await resolveInstagramTarget(organizationId, null);
  return resolution.ok ? resolution.externalAccountId : null;
}

export async function listInstagramHandles(organizationId: string): Promise<string[]> {
  const channels = await socialRepositoriesForOrganization(organizationId).channels.listForTenant("INSTAGRAM");
  return channels.filter((channel) => channel.status === "ACTIVE" && channel.handle).map((channel) => channel.handle!);
}

export type InstagramPublisherAccess = {
  channelId: string;
  externalAccountId: string;
  handle: string | null;
  publisher: ContentPublisher;
};

/** Publicador da conta, buscado dentro do passo que vai usá-lo: o token nunca viaja no plano (spec 0071, RNF-1). */
export async function loadInstagramPublisher(organizationId: string, channelId: string): Promise<InstagramPublisherAccess> {
  const channel = await socialRepositoriesForOrganization(organizationId).channels.findWithCredentialsById(channelId);
  if (!channel) throw new PublishAccountUnavailableError(MISSING_ACCOUNT_MESSAGE);
  if (channel.status === "DISABLED") throw new PublishAccountUnavailableError(DISABLED_ACCOUNT_MESSAGE);
  return {
    channelId: channel.id,
    externalAccountId: channel.externalAccountId,
    handle: channel.handle,
    publisher: createContentPublisher(channel),
  };
}

/** Conta de um post já publicado, para ler métricas e comentários. */
export async function loadInstagramPublisherForPost(post: { organizationId: string; targetIgAccountId: string | null }) {
  const { channels } = socialRepositoriesForOrganization(post.organizationId);
  const candidates = (await channels.listForTenant("INSTAGRAM")).filter((channel) => channel.status !== "DISABLED");
  const summary = post.targetIgAccountId
    ? candidates.find((channel) => channel.externalAccountId === post.targetIgAccountId)
    : candidates.length === 1
      ? candidates[0]
      : undefined;
  if (!summary) return null;
  const access = await loadInstagramPublisher(post.organizationId, summary.id);
  return { ...access, canReadInsights: summary.canReadInsights };
}

export async function markInstagramChannelNeedsReconnect(organizationId: string, channelId: string, reason: string) {
  await socialRepositoriesForOrganization(organizationId).channels.markNeedsReconnect(channelId, reason);
}

export type InstagramPublishAccount = {
  id: string;
  organizationId: string;
  kind: "IG_BUSINESS";
  pageId: string;
  pageName: string | null;
  igUserId: string;
  igUsername: string | null;
  profilePictureUrl: string | null;
  status: "ACTIVE" | "NEEDS_RECONNECT";
  lastErrorMessage: string | null;
  canPublish: boolean | null;
};

/** Mesmo formato das contas de publicação antigas, para as telas do Planner não mudarem de contrato. */
export async function listInstagramPublishAccounts(organizationIds: string[]): Promise<InstagramPublishAccount[]> {
  const accountsByOrganization = await Promise.all(
    organizationIds.map(async (organizationId) => {
      const channels = await socialRepositoriesForOrganization(organizationId).channels.listForTenant("INSTAGRAM");
      return channels
        .filter((channel) => channel.status !== "DISABLED")
        .map((channel): InstagramPublishAccount => ({
          id: channel.id,
          organizationId,
          kind: "IG_BUSINESS",
          pageId: "",
          pageName: channel.displayName,
          igUserId: channel.externalAccountId,
          igUsername: channel.handle,
          profilePictureUrl: null,
          status: channel.status === "NEEDS_RECONNECT" ? "NEEDS_RECONNECT" : "ACTIVE",
          lastErrorMessage: channel.lastErrorMessage,
          canPublish: channel.canPublish,
        }));
    }),
  );
  return accountsByOrganization.flat();
}
