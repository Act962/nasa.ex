export type EventType = "COMMENT_CREATED" | "DIRECT_MESSAGE_RECEIVED";
export type TargetScope = "ALL_CONTENT" | "SPECIFIC_CONTENT";
export type ContentType =
  | "IMAGE"
  | "VIDEO"
  | "CAROUSEL"
  | "REEL"
  | "STORY"
  | "OTHER";

/** Publicação vinda da conta conectada, já no formato que a UI consome. */
export type ContentRef = {
  externalId: string;
  contentType: ContentType;
  caption?: string;
  mediaUrl?: string;
  permalink?: string;
};

export type EditorTarget = {
  externalContentId: string;
  contentType: ContentType;
  mediaUrl?: string | null;
  permalink?: string | null;
  caption?: string | null;
};

export type EditorState = {
  triggerId?: string;
  eventType: EventType;
  targetScope: TargetScope;
  targets: EditorTarget[];
  anyText: boolean;
  includeTerms: string[];
  excludeTerms: string[];
  dmSource: "STATIC" | "AI";
  dmText: string;
  aiPrompt: string;
  buttons: { title: string; url: string }[];
  publicReplyEnabled: boolean;
  publicReplies: string[];
};

export const EMPTY_EDITOR_STATE: EditorState = {
  eventType: "COMMENT_CREATED",
  targetScope: "ALL_CONTENT",
  targets: [],
  anyText: false,
  includeTerms: [],
  excludeTerms: [],
  dmSource: "STATIC",
  dmText: "",
  aiPrompt: "",
  buttons: [],
  publicReplyEnabled: false,
  publicReplies: [],
};

/**
 * O painel é um roteador de telas, não um formulário só. Despejar as três
 * etapas de uma vez foi o que deixou a barra lateral parecendo um painel de
 * controle — o usuário não sabe por onde começar.
 */
export type PanelView =
  | { kind: "overview" }
  | { kind: "trigger"; stepIndex: number }
  | { kind: "triggerSummary" }
  | { kind: "response" };
