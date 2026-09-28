// Modelos prontos para o criador de templates (spec 0040, RF-2). Utilidade é
// não-promocional e ligada à conta do cliente — sem oferta, cupom ou "renove",
// senão a Meta reclassifica como Marketing.

import type { TemplateCategory } from "./template-constants";

export interface TemplatePreset {
  id: string;
  label: string;
  category: TemplateCategory;
  name: string;
  bodyText: string;
  bodyExamples: string[];
  footer: string;
  button: { text: string; url: string };
}

export const STARS_FRIENDS_PRESET_ID = "stars-friends";

export function buildInChatUrl(origin: string, organizationSlug: string): string {
  return `${origin.replace(/\/$/, "")}/whatsapp/${organizationSlug}`;
}

export function starsFriendsUtilityPreset(inChatUrl: string): TemplatePreset {
  return {
    id: STARS_FRIENDS_PRESET_ID,
    label: "Saldo STARS FRIENDS (Utilidade)",
    category: "UTILITY",
    name: "saldo_stars_friends",
    bodyText:
      "Olá {{1}}, seu saldo de pontos STARS FRIENDS foi atualizado. Acompanhe seu saldo e seu histórico pelo nosso canal de atendimento.",
    bodyExamples: ["Maria"],
    footer: "Mensagem sobre a sua conta",
    button: { text: "Ver meu saldo", url: inChatUrl },
  };
}

export function resolveTemplatePreset(presetId: string | undefined, inChatUrl: string | null): TemplatePreset | null {
  if (presetId === STARS_FRIENDS_PRESET_ID && inChatUrl) return starsFriendsUtilityPreset(inChatUrl);
  return null;
}
