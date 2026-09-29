/** Valores do formulário de site do ASTRO CHAT, compartilhados por criar e editar. */

export type SiteFormValues = {
  name: string;
  allowedOrigins: string[];
  trackingId: string;
  statusId: string | null;
  aiEnabled: boolean;
  assistantName: string;
  greeting: string;
  instructions: string;
  knowledgeIds: string[];
  accentColor: string;
  avatarUrl: string | null;
  widgetTheme: "light" | "dark";
  blockedTopicIds: string[];
  restrictionNotes: string;
  position: "right" | "left";
  privacyUrl: string;
  dailyAiReplyLimit: number;
};

export const EMPTY_SITE_FORM: SiteFormValues = {
  name: "",
  allowedOrigins: [],
  trackingId: "",
  statusId: null,
  aiEnabled: true,
  assistantName: "Astro",
  greeting: "Oi! Eu sou o Astro. Posso te ajudar?",
  instructions: "",
  knowledgeIds: [],
  accentColor: "#7C3AED",
  avatarUrl: null,
  widgetTheme: "light",
  blockedTopicIds: [],
  restrictionNotes: "",
  position: "right",
  privacyUrl: "",
  dailyAiReplyLimit: 300,
};

export function toSitePayload(values: SiteFormValues) {
  return {
    ...values,
    instructions: values.instructions.trim() || null,
    privacyUrl: values.privacyUrl.trim() || null,
    restrictionNotes: values.restrictionNotes.trim() || null,
  };
}
