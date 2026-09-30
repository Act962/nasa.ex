import type { GuideShot, MetaGuideDefinition, MetaGuidePhase, MetaGuideStep } from "./types";

/** Muda quando o recorte/alvo muda: o navegador não mostra o print antigo guardado em cache. */
function shotVersion(shot: GuideShot): string {
  const signature = [...(shot.crop ?? []), ...shot.target, shot.arrow].join("-");
  let hash = 0;
  for (const character of signature) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

export function guideImageSrc(step: MetaGuideStep, imageBasePath: string): string | null {
  if (!step.shot) return null;
  return `${imageBasePath}/${String(step.n).padStart(2, "0")}-${step.slug}.webp?v=${shotVersion(step.shot)}`;
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

export function findPhase(phases: MetaGuidePhase[], id: string): MetaGuidePhase {
  return phases.find((phase) => phase.id === id) ?? phases[0];
}

export function visibleGuideSteps<TStep extends MetaGuideStep>(
  guide: MetaGuideDefinition<TStep>,
  isManualMode: boolean,
): TStep[] {
  const isVisible = guide.isStepVisible ?? ((step: TStep, isManual: boolean) => isManual || !step.isAutomated);
  return guide.steps.filter((step) => isVisible(step, isManualMode));
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
