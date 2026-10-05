import {
  ChannelLimitReachedError,
  ChannelNotFoundError,
  InvalidCredentialsError,
} from "../domain/errors";
import type { ChannelCredentials, SocialProviderValue } from "../domain/types";
import type { ChannelGateway } from "../ports/channel-gateway";
import type { ChannelRepository, ChannelSummary } from "../ports/repositories";

/** Teto de contas em uso por rede em cada organização (spec 0069, RNF-3). */
export const MAX_CHANNELS_PER_PROVIDER = 20;

/**
 * Desconectar só desativa a linha, para preservar automações e histórico. Se a
 * desativada contasse, uma organização que já teve 20 contas nunca conectaria outra.
 */
export async function assertChannelCapacity(channels: ChannelRepository, provider: SocialProviderValue): Promise<void> {
  const channelsInUse = (await channels.listForTenant(provider)).filter((channel) => channel.status !== "DISABLED");
  if (channelsInUse.length >= MAX_CHANNELS_PER_PROVIDER) {
    throw new ChannelLimitReachedError(MAX_CHANNELS_PER_PROVIDER);
  }
}

export type ConnectChannelInput = {
  provider: SocialProviderValue;
  externalAccountId: string;
  credentials: ChannelCredentials;
  connectedById?: string | null;
};

export type ConnectChannelDeps = {
  channels: ChannelRepository;
  /** Gateway já construído com as credenciais que estão sendo testadas. */
  gateway: ChannelGateway;
  generateWebhookPathToken: () => string;
};

export type ConnectChannelResult = {
  channel: ChannelSummary;
  /** Falso quando a conta já era da organização e só a credencial mudou. */
  isNewChannel: boolean;
  /** A conta passou a entregar eventos? Falso vira aviso na UI. */
  subscribed: boolean;
  subscriptionError: string | null;
};

/**
 * Conecta uma conta (spec 0024 D-2; várias por organização na spec 0069).
 *
 * A credencial é conferida contra o provider ANTES de salvar: conectar com
 * token inválido e só descobrir no primeiro comentário real é o tipo de falha
 * que o usuário não consegue diagnosticar sozinho.
 */
export async function connectChannel(
  input: ConnectChannelInput,
  deps: ConnectChannelDeps,
): Promise<ConnectChannelResult> {
  const { accessToken, appSecret, verifyToken, authMode } = input.credentials;
  // Pelo login da Meta (spec 0061) o webhook é o da plataforma: sem app secret nem verify token próprios.
  const needsOwnWebhookSecrets = authMode !== "META_LOGIN";
  if (!accessToken.trim() || (needsOwnWebhookSecrets && (!appSecret.trim() || !verifyToken.trim()))) {
    throw new InvalidCredentialsError(
      "Informe token de acesso, app secret e verify token.",
    );
  }

  const profile = await deps.gateway.fetchAccountProfile();
  if (!profile) {
    throw new InvalidCredentialsError(
      "O provider recusou o token informado. Confira se ele não expirou e se tem as permissões de comentários e mensagens.",
    );
  }

  if (profile.externalAccountId !== input.externalAccountId) {
    throw new InvalidCredentialsError(
      `O token pertence à conta ${profile.externalAccountId}, diferente do ID informado (${input.externalAccountId}).`,
    );
  }

  const alreadyConnected = await deps.channels.findByExternalAccountId(
    input.provider,
    input.externalAccountId,
  );
  if (!alreadyConnected) await assertChannelCapacity(deps.channels, input.provider);

  const { channel, isNewChannel } = await deps.channels.connect({
    provider: input.provider,
    externalAccountId: input.externalAccountId,
    handle: profile.handle ?? null,
    displayName: profile.displayName ?? null,
    credentials: input.credentials,
    webhookPathToken: deps.generateWebhookPathToken(),
    connectedById: input.connectedById ?? null,
  });

  // Conta desativada só troca a credencial: reinscrever a faria voltar a receber eventos.
  if (channel.status === "DISABLED") {
    return { channel, isNewChannel, subscribed: false, subscriptionError: null };
  }

  // Sem isto a conta nunca entrega evento nenhum — a verificação da URL passa,
  // e o silêncio depois é indistinguível de "automação errada". Best-effort:
  // não desfaz a conexão, mas o resultado vai para a UI.
  const subscription = await deps.gateway.subscribeToEvents();

  return {
    channel,
    isNewChannel,
    subscribed: subscription.ok,
    subscriptionError: subscription.ok ? null : subscription.error,
  };
}

export type ReconnectChannelInput = {
  channelId: string;
  accessToken: string;
  /** Omitido mantém o app secret salvo. */
  appSecret?: string;
  connectedById?: string | null;
};

export type ReconnectChannelDeps = {
  channels: ChannelRepository;
  createGateway: (externalAccountId: string, accessToken: string) => ChannelGateway;
  generateWebhookPathToken: () => string;
};

/**
 * Troca a credencial de uma conta já conectada.
 *
 * A conta da linha nunca muda (spec 0069, CB-8): o ID conferido é o que já está
 * salvo, então um token de outra conta é recusado. Trocar a conta de uma linha
 * foi a origem do bug da spec 0024 D-13. O verify token é mantido — ele já está
 * colado no App da Meta.
 */
export async function reconnectChannel(
  input: ReconnectChannelInput,
  deps: ReconnectChannelDeps,
): Promise<ConnectChannelResult> {
  const channel = await deps.channels.findWithCredentialsById(input.channelId);
  if (!channel) throw new ChannelNotFoundError();
  if (channel.credentials.authMode === "META_LOGIN") {
    throw new InvalidCredentialsError(
      "Esta conta usa a conexão da Meta. Reconecte a Meta para renovar o acesso.",
    );
  }

  return connectChannel(
    {
      provider: channel.provider,
      externalAccountId: channel.externalAccountId,
      credentials: {
        ...channel.credentials,
        accessToken: input.accessToken,
        appSecret: input.appSecret?.trim() || channel.credentials.appSecret,
      },
      connectedById: input.connectedById,
    },
    {
      channels: deps.channels,
      gateway: deps.createGateway(channel.externalAccountId, input.accessToken),
      generateWebhookPathToken: deps.generateWebhookPathToken,
    },
  );
}
