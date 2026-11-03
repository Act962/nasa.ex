// Análise do criativo pelo Astro (spec 0126, RF-11..RF-13, D-8). Regras puras:
// o técnico não usa IA, e o veredito final junta técnico, política e força do anúncio.

export type CreativeReviewGroup = "policy" | "technical" | "strength";
export type CreativeReviewLevel = "OK" | "WARNING" | "BLOCKED";
export type CreativeReviewVerdict = "ready" | "improve" | "risk";

export interface CreativeReviewItem {
  group: CreativeReviewGroup;
  level: CreativeReviewLevel;
  label: string;
  fix: string;
  /** Link da política da Meta, quando o item vem de uma regra cadastrada. */
  sourceUrl?: string;
}

export interface CreativeReview {
  score: number;
  verdict: CreativeReviewVerdict;
  summary: string;
  items: CreativeReviewItem[];
  /** Texto que a IA leu na imagem (passou pelo prescreen). */
  readText: string;
  framesAnalyzed: number;
  analyzedAt: string;
}

export interface CreativeTechnicalInput {
  kind: "IMAGE" | "VIDEO";
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  fileSize: number | null;
}

export const CREATIVE_REVIEW_VERDICT_LABEL: Record<CreativeReviewVerdict, string> = {
  ready: "Pronto",
  improve: "Dá para melhorar",
  risk: "Risco de reprovação",
};

export const CREATIVE_REVIEW_GROUP_LABEL: Record<CreativeReviewGroup, string> = {
  policy: "Política da Meta",
  technical: "Técnico",
  strength: "Força do anúncio",
};

/** Proporções que a Meta recomenda: 1:1 e 4:5 no feed, 9:16 em Stories e Reels, 1,91:1 em link. */
const RECOMMENDED_RATIOS = [
  { ratio: 1, label: "1:1" },
  { ratio: 4 / 5, label: "4:5" },
  { ratio: 9 / 16, label: "9:16" },
  { ratio: 1.91, label: "1,91:1" },
];
const RATIO_TOLERANCE = 0.03;
const MIN_RECOMMENDED_WIDTH_PX = 1080;
const MIN_ACCEPTED_WIDTH_PX = 600;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_VERTICAL_VIDEO_SECONDS = 90;
const MIN_VIDEO_SECONDS = 3;

export function matchRecommendedRatio(width: number, height: number): string | null {
  if (width <= 0 || height <= 0) return null;
  const ratio = width / height;
  const match = RECOMMENDED_RATIOS.find(
    (candidate) => Math.abs(ratio - candidate.ratio) / candidate.ratio <= RATIO_TOLERANCE,
  );
  return match?.label ?? null;
}

/** Checagem técnica sem IA (CA-7). */
export function checkCreativeTechnical(input: CreativeTechnicalInput): CreativeReviewItem[] {
  const items: CreativeReviewItem[] = [];
  const kindLabel = input.kind === "VIDEO" ? "vídeo" : "imagem";

  if (input.width && input.height) {
    const ratioLabel = matchRecommendedRatio(input.width, input.height);
    if (!ratioLabel) {
      items.push({
        group: "technical",
        level: "WARNING",
        label: "Formato fora do recomendado",
        fix: `Corte a ${kindLabel} em 1:1 ou 4:5 para o feed, ou 9:16 para Stories e Reels.`,
      });
    }
    const shortestSide = Math.min(input.width, input.height);
    if (shortestSide < MIN_ACCEPTED_WIDTH_PX) {
      items.push({
        group: "technical",
        level: "BLOCKED",
        label: "Resolução abaixo do mínimo da Meta",
        fix: `Use pelo menos ${MIN_RECOMMENDED_WIDTH_PX} px no menor lado; a Meta recusa menos de ${MIN_ACCEPTED_WIDTH_PX} px.`,
      });
    } else if (shortestSide < MIN_RECOMMENDED_WIDTH_PX) {
      items.push({
        group: "technical",
        level: "WARNING",
        label: "Resolução baixa",
        fix: `Envie com pelo menos ${MIN_RECOMMENDED_WIDTH_PX} px no menor lado para não ficar borrado.`,
      });
    }
    if (ratioLabel === "9:16") {
      items.push({
        group: "technical",
        level: "OK",
        label: "Margens seguras do 9:16",
        fix: "Deixe texto e logo longe dos 14% de cima e dos 20% de baixo, onde ficam os botões do Stories e do Reels.",
      });
    }
  }

  const maxBytes = input.kind === "VIDEO" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (input.fileSize && input.fileSize > maxBytes) {
    items.push({
      group: "technical",
      level: "BLOCKED",
      label: "Arquivo maior que o limite da Meta",
      fix: input.kind === "VIDEO" ? "Comprima o vídeo para menos de 4 GB." : "Comprima a imagem para menos de 30 MB.",
    });
  }

  if (input.kind === "VIDEO" && input.durationSeconds !== null) {
    if (input.durationSeconds < MIN_VIDEO_SECONDS) {
      items.push({
        group: "technical",
        level: "WARNING",
        label: "Vídeo curto demais",
        fix: `Vídeos com menos de ${MIN_VIDEO_SECONDS} segundos entregam pouco; use de 6 a 15 segundos.`,
      });
    } else if (input.durationSeconds > MAX_VERTICAL_VIDEO_SECONDS) {
      items.push({
        group: "technical",
        level: "WARNING",
        label: "Vídeo longo",
        fix: "A maioria das pessoas sai antes de 15 segundos: corte para a mensagem principal caber no começo.",
      });
    }
  }

  return items;
}

const LEVEL_PENALTY: Record<CreativeReviewLevel, number> = { OK: 0, WARNING: 8, BLOCKED: 25 };
const RISK_SCORE_CEILING = 40;
const READY_SCORE_FLOOR = 75;

/**
 * Nota e veredito finais. A nota da IA (força do anúncio) perde pontos por problema
 * técnico ou de política; qualquer BLOCKED vira "Risco de reprovação" (CA-6).
 */
export function buildCreativeVerdict(params: {
  modelScore: number | null;
  items: CreativeReviewItem[];
}): { score: number; verdict: CreativeReviewVerdict } {
  const baseScore = params.modelScore ?? 70;
  const penalty = params.items.reduce((total, item) => total + LEVEL_PENALTY[item.level], 0);
  const hasBlocked = params.items.some((item) => item.level === "BLOCKED");
  const hasPolicyWarning = params.items.some((item) => item.group === "policy" && item.level === "WARNING");

  let score = Math.max(0, Math.min(100, Math.round(baseScore - penalty)));
  if (hasBlocked) score = Math.min(score, RISK_SCORE_CEILING);

  const verdict: CreativeReviewVerdict = hasBlocked
    ? "risk"
    : score >= READY_SCORE_FLOOR && !hasPolicyWarning
      ? "ready"
      : "improve";
  return { score, verdict };
}

/** Vídeo que o navegador não conseguiu ler (CB-6): o técnico vale, a nota fica neutra. */
export function buildTechnicalOnlyReview(technical: CreativeTechnicalInput): CreativeReview {
  const items = checkCreativeTechnical(technical);
  const { score, verdict } = buildCreativeVerdict({ modelScore: null, items });
  return {
    score,
    verdict,
    summary:
      "Não deu para ver as imagens deste vídeo no navegador, então o Astro conferiu só a parte técnica. Envie em MP4 (H.264) para a análise completa.",
    items,
    readText: "",
    framesAnalyzed: 0,
    analyzedAt: new Date().toISOString(),
  };
}
