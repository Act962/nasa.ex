import { InvalidCredentialsError } from "../domain/errors";
import type { ChannelCredentials, SocialProviderValue } from "../domain/types";
import type { ChannelGateway } from "../ports/channel-gateway";
import type {
  AutomationRepository,
  ChannelRepository,
  ChannelSummary,
} from "../ports/repositories";

export type ConnectChannelInput = {
  provider: SocialProviderValue;
  externalAccountId: string;
  credentials: ChannelCredentials;
  connectedById?: string | null;
};

export type ConnectChannelDeps = {
  channels: ChannelRepository;
  automations: Pick<AutomationRepository, "deactivateTargetingContent">;
  /** Gateway já construído com as credenciais que estão sendo testadas. */
  gateway: ChannelGateway;
  generateWebhookPathToken: () => string;
};

/**
 * Conecta a conta com credenciais informadas à mão (spec 0024 D-2).
 *
 * A credencial é conferida contra o provider ANTES de salvar: conectar com
 * token inválido e só descobrir no primeiro comentário real é o tipo de falha
 * que o usuário não consegue diagnosticar sozinho.
 */
export type ConnectChannelResult = {
  channel: ChannelSummary;
  /** A conta passou a entregar eventos? Falso vira aviso na UI. */
  subscribed: boolean;
  subscriptionError: string | null;
  /** Conta anterior, quando a conexão trocou de conta — `null` se não trocou. */
  replacedExternalAccountId: string | null;
  /** Automações desativadas por apontarem para posts da conta anterior. */
  deactivatedAutomations: number;
};

export async function connectChannel(
  input: ConnectChannelInput,
  deps: ConnectChannelDeps,
): Promise<ConnectChannelResult> {
  const { accessToken, appSecret, verifyToken } = input.credentials;
  if (!accessToken.trim() || !appSecret.trim() || !verifyToken.trim()) {
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

  const { channel, replacedExternalAccountId } = await deps.channels.connect({
    provider: input.provider,
    externalAccountId: input.externalAccountId,
    handle: profile.handle ?? null,
    displayName: profile.displayName ?? null,
    credentials: input.credentials,
    webhookPathToken: deps.generateWebhookPathToken(),
    connectedById: input.connectedById ?? null,
  });

  // Trocou de conta: o que aponta para publicação específica da conta anterior
  // não tem como casar na nova. Desativa e devolve a contagem para a UI avisar,
  // em vez de deixar automação ativa que nunca dispara.
  const deactivatedAutomations = replacedExternalAccountId
    ? await deps.automations.deactivateTargetingContent(channel.id)
    : 0;

  // Sem isto a conta nunca entrega evento nenhum — a verificação da URL passa,
  // e o silêncio depois é indistinguível de "automação errada". Best-effort:
  // não desfaz a conexão, mas o resultado vai para a UI.
  const subscription = await deps.gateway.subscribeToEvents();

  return {
    channel,
    subscribed: subscription.ok,
    subscriptionError: subscription.ok ? null : subscription.error,
    replacedExternalAccountId,
    deactivatedAutomations,
  };
}
