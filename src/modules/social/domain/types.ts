/**
 * Tipos do domínio de automações sociais.
 *
 * São uniões de string declaradas aqui de propósito, e não importadas de
 * `@/generated/prisma/enums`: o domínio não pode depender de infraestrutura.
 * Os valores coincidem com os do Prisma, então o mapeamento no adapter é
 * identidade — mas a dependência continua apontando para dentro.
 */

export type SocialProviderValue = "INSTAGRAM";

export type SocialEventTypeValue =
  | "COMMENT_CREATED"
  | "DIRECT_MESSAGE_RECEIVED";

export type SocialTargetScopeValue =
  | "ALL_CONTENT"
  | "SPECIFIC_CONTENT"
  | "NEXT_CONTENT";

export type SocialMatchKindValue = "INCLUDE" | "EXCLUDE";

export type SocialMatchOperatorValue =
  | "ANY_TEXT"
  | "CONTAINS"
  | "EXACT"
  | "STARTS_WITH";

export type SocialMatchLogicValue = "ANY_RULE" | "ALL_RULES";

export type SocialStepKindValue = "SEND_DIRECT_MESSAGE" | "REPLY_TO_COMMENT";

export type SocialContentTypeValue =
  | "IMAGE"
  | "VIDEO"
  | "CAROUSEL"
  | "REEL"
  | "STORY"
  | "OTHER";

export type SocialChannelStatusValue =
  | "ACTIVE"
  | "NEEDS_RECONNECT"
  | "DISABLED";

export type SocialRunStatusValue = "PENDING" | "SENT" | "SKIPPED" | "FAILED";

/** Evento inbound canônico. Nenhum campo aqui é específico de uma rede. */
export type InboundEvent = {
  provider: SocialProviderValue;
  externalAccountId: string;
  externalEventId: string;
  type: SocialEventTypeValue;
  actor: { externalUserId: string; username?: string };
  text: string;
  content?: { externalId: string };
  occurredAt: Date;
};

export type MessageButton = {
  type: "URL";
  title: string;
  url: string;
};

export type SendDirectMessageConfig = {
  source: "STATIC" | "AI";
  text?: string;
  aiPrompt?: string;
  buttons: MessageButton[];
};

export type ReplyToCommentConfig = {
  variants: string[];
  strategy: "RANDOM" | "SEQUENTIAL";
};

export type FlowStepConfig = SendDirectMessageConfig | ReplyToCommentConfig;

export type FlowStep = {
  id: string;
  kind: SocialStepKindValue;
  order: number;
  isEnabled: boolean;
  config: FlowStepConfig;
};

export type MatchRule = {
  id: string;
  kind: SocialMatchKindValue;
  operator: SocialMatchOperatorValue;
  terms: string[];
};

export type TriggerTarget = {
  externalContentId: string;
  /**
   * Campos de apresentação vindos do provider. O casamento de gatilho usa só
   * `externalContentId` — estes existem para a UI mostrar a publicação em vez
   * de um id cru, e viajam junto para não exigir uma segunda consulta.
   */
  contentType?: SocialContentTypeValue;
  mediaUrl?: string | null;
  permalink?: string | null;
  caption?: string | null;
};

export type Trigger = {
  id: string;
  automationId: string;
  eventType: SocialEventTypeValue;
  targetScope: SocialTargetScopeValue;
  matchLogic: SocialMatchLogicValue;
  isEnabled: boolean;
  createdAt: Date;
  targets: TriggerTarget[];
  rules: MatchRule[];
  steps: FlowStep[];
};

export type Automation = {
  id: string;
  organizationId: string;
  channelId: string;
  name: string;
  isActive: boolean;
  triggers: Trigger[];
};

export type ChannelCredentials = {
  accessToken: string;
  appSecret: string;
  verifyToken: string;
};

export type Channel = {
  id: string;
  organizationId: string;
  provider: SocialProviderValue;
  externalAccountId: string;
  webhookPathToken: string;
  handle: string | null;
  displayName: string | null;
  status: SocialChannelStatusValue;
  credentials: ChannelCredentials;
};

export type ContentRef = {
  externalId: string;
  contentType: SocialContentTypeValue;
  caption?: string;
  mediaUrl?: string;
  permalink?: string;
};
