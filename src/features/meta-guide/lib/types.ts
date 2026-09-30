// Contrato de um guia "tela da Meta a tela da Meta" (specs 0040 e 0047).

export type GuideArrowSide = "top" | "right" | "bottom" | "left";

export interface GuideShot {
  w: number;
  h: number;
  target: [number, number, number, number];
  arrow: GuideArrowSide;
  /** Recorte aplicado pelo script de prints (foca no que importa). */
  crop?: [number, number, number, number];
}

export interface MetaGuideStep {
  n: number;
  phase: string;
  slug: string;
  title: string;
  instruction: string;
  link?: string;
  /** Botão "Abrir na Meta" grande e centralizado (passo sem print). */
  isLinkHighlighted?: boolean;
  copy?: string[];
  isAutomated?: boolean;
  shot?: GuideShot;
  /** Aviso para um erro comum da Meta neste passo. */
  tip?: string;
  /** Passo-pergunta: "sim" pula para `skipToSlug`, "não" segue para o próximo. */
  choice?: { yesLabel: string; noLabel: string; skipToSlug: string };
}

export interface MetaGuidePhase {
  id: string;
  title: string;
  cheer: string;
}

export interface MetaGuideMilestone {
  percent: number;
  headline: string;
}

export interface MetaAccountIds {
  appId: string | null;
  businessId: string | null;
}

export interface MetaGuideDefinition<TStep extends MetaGuideStep = MetaGuideStep> {
  /** Prefixo dos balões do Astro — um balão não repete entre guias. */
  id: string;
  /** Pasta em `public/` com os prints `NN-slug.webp`. */
  imageBasePath: string;
  phases: MetaGuidePhase[];
  steps: TStep[];
  milestones: MetaGuideMilestone[];
  copyLabels: Record<string, string>;
  /** Link do passo apontando para o app do cliente; sem ele, usa `step.link`. */
  stepLink?: (step: TStep, accountIds: MetaAccountIds) => string | null;
  /** O link abre no app do próprio cliente ("Abrir no seu app"). */
  isPersonalLink?: (step: TStep, accountIds: MetaAccountIds) => boolean;
  isStepVisible?: (step: TStep, isManualMode: boolean) => boolean;
}
