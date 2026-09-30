// Guia "Conectar WhatsApp Oficial" (spec 0040, RF-3/RF-11): os 38 passos das
// telas da Meta, com o print, o alvo da seta vermelha e os balões do Astro.
// Os dados moram no JSON para o script de prints (scripts/guides) ler o mesmo.

import type { MetaAccountIds, MetaGuideDefinition, MetaGuideStep } from "@/features/meta-guide/lib/types";
import guideData from "./whatsapp-connect-guide.json";

export type { GuideArrowSide, GuideShot, MetaAccountIds } from "@/features/meta-guide/lib/types";

export type GuidePhaseId = "app" | "whatsapp" | "number" | "payment" | "token" | "keys" | "webhook" | "publish";
export type GuideCopyKey = "callbackUrl" | "verifyToken";

/** Telas da Meta que abrem direto no app/portfólio do cliente. */
export type GuideLinkKey =
  | "appDashboard"
  | "appUseCases"
  | "waQuickstart"
  | "waApiSetup"
  | "waWebhook"
  | "appSettingsBasic"
  | "bizWhatsappAccounts"
  | "bizSystemUsers"
  | "waManagerPhones";

export interface GuideStep extends MetaGuideStep {
  phase: GuidePhaseId;
  linkKey?: GuideLinkKey;
  copy?: GuideCopyKey[];
}

export interface GuidePhase {
  id: GuidePhaseId;
  title: string;
  cheer: string;
}

export const GUIDE_PHASES = guideData.phases as GuidePhase[];
export const GUIDE_STEPS = guideData.steps as GuideStep[];

/** Passos que o cliente faz na Meta — os automatizados ficam como plano B. */
export const MANUAL_GUIDE_STEPS = GUIDE_STEPS.filter((step) => !step.isAutomated);
export const AUTOMATED_GUIDE_STEPS = GUIDE_STEPS.filter((step) => step.isAutomated);

export const DEFAULT_WEBHOOK_CALLBACK_URL = "https://orbita.nasaex.com/api/chat/webhook/official";

/** Tira o ID do app e o do portfólio do endereço de qualquer página do app na Meta. */
export function parseMetaAppPageUrl(url: string): MetaAccountIds {
  const appId = url.match(/\/apps\/(\d{8,20})/)?.[1] ?? (/^\d{8,20}$/.test(url.trim()) ? url.trim() : null);
  const businessId = url.match(/business_id=(\d{6,20})/)?.[1] ?? null;
  return { appId, businessId };
}

const DEVELOPERS = "https://developers.facebook.com/apps";
const BUSINESS = "https://business.facebook.com/latest";

/**
 * Link do passo apontando para o app e o portfólio que o cliente escolheu —
 * ele não se perde entre apps e empresas. Sem os IDs, cai no link genérico.
 */
export function guideStepLink(step: GuideStep, ids: MetaAccountIds): string | null {
  if (!step.linkKey) return step.link ?? null;
  const business = ids.businessId ? `business_id=${ids.businessId}` : "";
  const withQuery = (base: string) => (business ? `${base}${base.includes("?") ? "&" : "?"}${business}` : base);
  const appBase = ids.appId ? `${DEVELOPERS}/${ids.appId}` : null;
  switch (step.linkKey) {
    case "bizWhatsappAccounts":
      return withQuery(`${BUSINESS}/settings/whatsapp_account`);
    case "bizSystemUsers":
      // Sem o portfólio, esta tela da Meta dá "conteúdo não disponível"; as Configurações abrem no último portfólio usado.
      return ids.businessId ? withQuery(`${BUSINESS}/settings/system_users`) : `${BUSINESS}/settings/`;
    case "waManagerPhones":
      return withQuery(`${BUSINESS}/whatsapp_manager/phone_numbers/`);
    default:
      break;
  }
  if (!appBase) return step.link ?? `${DEVELOPERS}/`;
  const appPaths: Record<string, string> = {
    appDashboard: "/dashboard/",
    appUseCases: "/use_cases/",
    waQuickstart: "/whatsapp-business/wa-dev-quickstart/",
    waApiSetup: "/whatsapp-business/wa-dev-console/",
    waWebhook: "/whatsapp-business/wa-settings/",
    appSettingsBasic: "/settings/basic/",
  };
  return withQuery(`${appBase}${appPaths[step.linkKey] ?? "/dashboard/"}`);
}

export function phaseOf(id: GuidePhaseId): GuidePhase {
  return GUIDE_PHASES.find((phase) => phase.id === id) ?? GUIDE_PHASES[0];
}

/** Marcos de progresso que disparam balão do Astro (uma vez cada). */
export const PROGRESS_MILESTONES: { percent: number; headline: string }[] = [
  { percent: 25, headline: "Bom começo! Um quarto do caminho já foi." },
  { percent: 50, headline: "Metade feita! Você está indo muito bem." },
  { percent: 75, headline: "Parabéns! Você está chegando perto de ter seu número oficial WhatsApp, falta pouco." },
  { percent: 100, headline: "Tudo pronto do lado da Meta! Agora é com a ÓRBITA." },
];

export const WHATSAPP_GUIDE: MetaGuideDefinition<GuideStep> = {
  id: "whatsapp-guide",
  imageBasePath: "/guides/whatsapp-oficial",
  phases: GUIDE_PHASES,
  steps: GUIDE_STEPS,
  milestones: PROGRESS_MILESTONES,
  copyLabels: { callbackUrl: "URL de callback", verifyToken: "Verificar token" },
  stepLink: guideStepLink,
  isPersonalLink: (step, accountIds) => Boolean(step.linkKey && accountIds.appId),
  isStepVisible: (step, isManualMode) => step.phase !== "payment" && (isManualMode || !step.isAutomated),
};
