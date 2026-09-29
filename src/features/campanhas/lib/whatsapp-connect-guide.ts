// Guia "Conectar WhatsApp Oficial" (spec 0040, RF-3/RF-11): os 38 passos das
// telas da Meta, com o print, o alvo da seta vermelha e os balões do Astro.
// Os dados moram no JSON para o script de prints (scripts/guides) ler o mesmo.

import guideData from "./whatsapp-connect-guide.json";

export type GuidePhaseId = "app" | "whatsapp" | "number" | "payment" | "token" | "keys" | "webhook" | "publish";
export type GuideArrowSide = "top" | "right" | "bottom" | "left";
export type GuideCopyKey = "callbackUrl" | "verifyToken";

export interface GuideShot {
  w: number;
  h: number;
  target: [number, number, number, number];
  arrow: GuideArrowSide;
  /** Recorte aplicado pelo script de prints (foca no que importa). */
  crop?: [number, number, number, number];
}

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

export interface GuideStep {
  n: number;
  phase: GuidePhaseId;
  slug: string;
  title: string;
  instruction: string;
  link?: string;
  linkKey?: GuideLinkKey;
  copy?: GuideCopyKey[];
  isAutomated?: boolean;
  shot?: GuideShot;
  /** Aviso para um erro comum da Meta neste passo (ex.: limite de usuários do sistema). */
  tip?: string;
  /** Passo-pergunta: "sim" pula para `skipToSlug`, "não" segue para o próximo. */
  choice?: { yesLabel: string; noLabel: string; skipToSlug: string };
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

/** Muda quando o recorte/alvo muda: o navegador não mostra o print antigo guardado em cache. */
function shotVersion(shot: GuideShot): string {
  const signature = [...(shot.crop ?? []), ...shot.target, shot.arrow].join("-");
  let hash = 0;
  for (const character of signature) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

export function guideImageSrc(step: GuideStep): string | null {
  if (!step.shot) return null;
  return `/guides/whatsapp-oficial/${String(step.n).padStart(2, "0")}-${step.slug}.webp?v=${shotVersion(step.shot)}`;
}

/** Alvo em % do print (já recortado), para posicionar o destaque sobre a imagem responsiva. */
export function guideTargetPercent(shot: GuideShot) {
  const [cropLeft, cropTop, cropRight, cropBottom] = shot.crop ?? [0, 0, shot.w, shot.h];
  const width = cropRight - cropLeft;
  const height = cropBottom - cropTop;
  const [left, top, right, bottom] = shot.target;
  return {
    left: ((left - cropLeft) / width) * 100,
    top: ((top - cropTop) / height) * 100,
    width: ((right - left) / width) * 100,
    height: ((bottom - top) / height) * 100,
  };
}

export interface MetaAccountIds {
  appId: string | null;
  businessId: string | null;
}

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

const ACTION_VERBS =
  "clique|confira|escolha|marque|ligue|cole|copie|abra|digite|escreva|preencha|role|espere|volte|troque|selecione|use|vá|gere|dê|receba|adicione|crie|feche|depois|mexa";
const ACTION_BREAK = new RegExp(`(?:,\\s+|\\s+e\\s+)(?=(?:${ACTION_VERBS})\\b)`, "i");

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

/**
 * Instrução quebrada em ações curtas (um ✅ por linha): separa as frases e,
 * dentro delas, antes de cada verbo de ação ("clique", "confira"...).
 */
export function instructionChecklist(instruction: string): string[] {
  const startsWithAction = new RegExp(`^(?:${ACTION_VERBS})\\b`, "i");
  return instruction
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú"])/)
    .flatMap((sentence) => {
      const [first, ...rest] = sentence.split(ACTION_BREAK);
      // "Em developers.facebook.com, clique…": o contexto fica junto da ação.
      if (rest.length && !startsWithAction.test(first.trim())) {
        const [next, ...others] = rest;
        return [`${first.trim()}, ${next}`, ...others];
      }
      return [first, ...rest];
    })
    .map((item) => capitalize(item.trim().replace(/[.,;]$/, "")))
    .filter(Boolean);
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
