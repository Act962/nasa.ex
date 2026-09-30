import { guideSelector } from "./anchors";
import type { GuideDef } from "./types";
import type { TourStep } from "@/features/tour/types";
import { TRACKING_GUIDES } from "./guides/tracking";
import { CHAT_GUIDES } from "./guides/chat";
import { AGENDA_GUIDES } from "./guides/agenda";
import { FORGE_GUIDES } from "./guides/forge";
import { FORM_GUIDES } from "./guides/form";
import { WORKSPACE_GUIDES } from "./guides/workspace";
import { PAYMENT_GUIDES } from "./guides/payment";
import { CAMPANHAS_GUIDES } from "./guides/campanhas";
import { SETTINGS_GUIDES } from "./guides/settings";
import { CONTACTS_GUIDES } from "./guides/contacts";
import { TRAFEGO_GUIDES } from "./guides/trafego";
import { PAGES_GUIDES } from "./guides/pages";
import { LINNKER_GUIDES } from "./guides/linnker";
import { NBOX_GUIDES } from "./guides/nbox";
import { PLANNER_GUIDES } from "./guides/planner";
import { ROUTE_GUIDES } from "./guides/route";
import { ENGAGEMENT_GUIDES } from "./guides/engagement";
import { INTEGRATIONS_GUIDES } from "./guides/integrations";
import { INSIGHTS_GUIDES } from "./guides/insights";
import { COMMENTS_GUIDES } from "./guides/comments";
import { ASTRO_APP_GUIDES } from "./guides/astro";

// Ordem importa: o primeiro guia cujo assunto casa responde. Assuntos mais
// específicos antes — "proposta pro lead" é Forge, "mensagem pro lead" é Chat,
// e só o que sobra cai nos guias genéricos de lead do Tracking.
export const ASTRO_GUIDES: GuideDef[] = [
  ...FORGE_GUIDES,
  ...FORM_GUIDES,
  ...AGENDA_GUIDES,
  // Antes de Campanhas: "campanha de tráfego" é trafeGO, não disparo em massa.
  ...TRAFEGO_GUIDES,
  // Antes do Chat: "mensagem em massa" é campanha, não conversa.
  ...CAMPANHAS_GUIDES,
  // Antes de Integrações: "conectar o Instagram" é o Comments.
  ...COMMENTS_GUIDES,
  ...CHAT_GUIDES,
  ...PAYMENT_GUIDES,
  ...WORKSPACE_GUIDES,
  ...SETTINGS_GUIDES,
  // Antes do Tracking: "cadastrar cliente/contato" parte de /contatos.
  ...CONTACTS_GUIDES,
  // Antes de Pages: "colocar o Astro no meu site" não é criar site.
  ...ASTRO_APP_GUIDES,
  ...PAGES_GUIDES,
  ...LINNKER_GUIDES,
  ...NBOX_GUIDES,
  ...PLANNER_GUIDES,
  ...ROUTE_GUIDES,
  ...ENGAGEMENT_GUIDES,
  ...INSIGHTS_GUIDES,
  ...INTEGRATIONS_GUIDES,
  ...TRACKING_GUIDES,
];

export function findGuide(guideKey: string): GuideDef | undefined {
  return ASTRO_GUIDES.find((guide) => guide.key === guideKey);
}

export function findGuideBySpaceHelp(categorySlug: string, featureSlug: string): GuideDef | undefined {
  return ASTRO_GUIDES.find(
    (guide) => guide.spaceHelp?.categorySlug === categorySlug && guide.spaceHelp.featureSlug === featureSlug,
  );
}

export function toTourSteps(guide: GuideDef): TourStep[] {
  return guide.steps.map((step, index) => ({
    id: `${guide.key}.${index}`,
    selector: guideSelector(step.anchor),
    title: step.title,
    message: step.message,
    position: step.position,
    padding: step.padding ?? 8,
    pulse: step.advanceOn === "click",
    advanceOn: step.advanceOn,
    route: step.route,
    skipWhenPath: step.skipWhenPath,
    skipWhenVisible: step.skipWhenVisible ? guideSelector(step.skipWhenVisible) : undefined,
    resultKind: step.resultKind,
    missingMessage: step.missingMessage,
  }));
}
