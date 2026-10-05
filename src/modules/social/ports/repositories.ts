import type { TenantScope } from "@/modules/shared/domain/tenant-scope";
import type {
  Automation,
  Channel,
  ChannelAuthModeValue,
  ChannelCredentials,
  SocialEventTypeValue,
  SocialProviderValue,
  SocialRunStatusValue,
  SocialStepKindValue,
  Trigger,
} from "../domain/types";

export type ChannelSummary = {
  id: string;
  provider: SocialProviderValue;
  externalAccountId: string;
  webhookPathToken: string;
  handle: string | null;
  displayName: string | null;
  status: Channel["status"];
  lastErrorMessage: string | null;
  lastErrorAt: Date | null;
  createdAt: Date;
  /** Últimos 4 caracteres do token — a UI nunca recebe o segredo inteiro. */
  accessTokenLast4: string;
  authMode: ChannelAuthModeValue;
  automationCount: number;
};

/**
 * `findByWebhookPathToken` é a **única** leitura sem escopo do módulo: o
 * webhook chega anônimo e é dela que o `TenantScope` nasce (spec 0024 D-12).
 * Todo o resto exige escopo no construtor.
 */
export interface ChannelLookupRepository {
  findByWebhookPathToken(
    provider: SocialProviderValue,
    webhookPathToken: string,
  ): Promise<{ channel: Channel; tenant: TenantScope } | null>;
  /** Webhook único da plataforma (spec 0061): o dono da conta é quem recebe. */
  findByExternalAccountId(
    provider: SocialProviderValue,
    externalAccountId: string,
  ): Promise<{ channel: Channel; tenant: TenantScope } | null>;
}

export type ConnectChannelOutcome = {
  channel: ChannelSummary;
  /** Falso quando a conta já existia na organização e só a credencial mudou. */
  isNewChannel: boolean;
};

/**
 * Uma organização tem várias contas (spec 0069, D-1). Não existe leitura de
 * "a conta da organização": quem chama sempre diz qual, pelo `channelId`.
 */
export interface ChannelRepository {
  listForTenant(provider?: SocialProviderValue): Promise<ChannelSummary[]>;
  countForTenant(provider: SocialProviderValue): Promise<number>;
  findById(channelId: string): Promise<ChannelSummary | null>;
  findWithCredentialsById(channelId: string): Promise<Channel | null>;
  findByExternalAccountId(
    provider: SocialProviderValue,
    externalAccountId: string,
  ): Promise<ChannelSummary | null>;
  /**
   * Conecta pela chave `(provider, externalAccountId)`: conta que já é da
   * organização tem a credencial atualizada; conta nova vira outra linha.
   * Nunca altera nem remove as demais contas.
   */
  connect(input: {
    provider: SocialProviderValue;
    externalAccountId: string;
    handle?: string | null;
    displayName?: string | null;
    credentials: ChannelCredentials;
    webhookPathToken: string;
    connectedById?: string | null;
  }): Promise<ConnectChannelOutcome>;
  disconnect(channelId: string): Promise<void>;
  markNeedsReconnect(channelId: string, reason: string): Promise<void>;
  markActive(channelId: string): Promise<void>;
}

export type AutomationListItem = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  triggerCount: number;
  sentCount: number;
};

export type UpsertTriggerInput = {
  automationId: string;
  triggerId?: string;
  eventType: SocialEventTypeValue;
  targetScope: Trigger["targetScope"];
  matchLogic: Trigger["matchLogic"];
  targets: {
    externalContentId: string;
    contentType: string;
    permalink?: string | null;
    caption?: string | null;
    mediaUrl?: string | null;
  }[];
  rules: {
    kind: "INCLUDE" | "EXCLUDE";
    operator: Trigger["rules"][number]["operator"];
    terms: string[];
  }[];
  steps: {
    kind: SocialStepKindValue;
    order: number;
    config: unknown;
  }[];
};

export interface AutomationRepository {
  listByChannel(channelId: string): Promise<AutomationListItem[]>;
  findById(automationId: string): Promise<Automation | null>;
  /** Automações ativas de um canal — caminho quente do webhook. */
  findActiveByChannel(channelId: string): Promise<Automation[]>;
  create(input: {
    channelId: string;
    name: string;
    createdById?: string | null;
  }): Promise<{ id: string }>;
  rename(automationId: string, name: string): Promise<void>;
  setActive(automationId: string, isActive: boolean): Promise<void>;
  remove(automationId: string): Promise<void>;
  upsertTrigger(input: UpsertTriggerInput): Promise<{ triggerId: string }>;
  removeTrigger(automationId: string, triggerId: string): Promise<void>;
}

export interface InboundEventRepository {
  /**
   * Registra o evento e diz se é a primeira vez. Colisão de
   * `[provider, externalEventId]` significa reentrega da Meta (CA-4).
   */
  registerOnce(input: {
    channelId: string;
    provider: SocialProviderValue;
    externalEventId: string;
    eventType: SocialEventTypeValue;
    externalUserId?: string;
    externalContentId?: string;
  }): Promise<{ isFirstTime: boolean; inboundEventId: string | null }>;

  markStatus(
    inboundEventId: string,
    status: "MATCHED" | "SKIPPED" | "FAILED",
    skipReason?: string,
  ): Promise<void>;
}

export type StepRunRecord = {
  stepId?: string | null;
  kind: SocialStepKindValue;
  status: SocialRunStatusValue;
  error?: string | null;
  externalMessageId?: string | null;
  durationMs?: number | null;
};

export interface RunRepository {
  start(input: {
    automationId: string;
    triggerId: string;
    channelId: string;
    inboundEventId?: string | null;
    contactId?: string | null;
  }): Promise<{ runId: string }>;

  finish(
    runId: string,
    status: SocialRunStatusValue,
    steps: StepRunRecord[],
    error?: string | null,
  ): Promise<void>;

  /** Quantas execuções a automação já teve — base do modo SEQUENTIAL. */
  countByAutomation(automationId: string): Promise<number>;
}

export interface ContactRepository {
  upsertFromInbound(input: {
    channelId: string;
    externalUserId: string;
    username?: string;
    occurredAt: Date;
  }): Promise<{ contactId: string }>;

  markOutbound(contactId: string, at: Date): Promise<void>;
}
