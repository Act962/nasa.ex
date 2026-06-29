import "server-only";

import prisma from "@/lib/prisma";

/**
 * Brand context builder — núcleo do NASA Planner 2.0.
 *
 * Lê todos os campos de brand kit da `Organization` (slogan, ICP, tom de
 * voz, posicionamento, paleta hex, fontes do Google Fonts, logo + variantes)
 * e devolve dois "pacotes prontos" pra serem injetados nas chamadas de IA:
 *
 *  - `imagePromptSuffix`: trecho em inglês acoplado ao final de prompts de
 *    geração de imagem (DALL-E, Ideogram, Recraft, Pollinations). Reforça
 *    paleta, tipografia, estilo e mood — sem isso, o modelo cria imagens
 *    aleatórias que fogem da identidade da marca.
 *  - `textSystemPrompt`: trecho em português pra ser concatenado ao
 *    `system` de geração de texto (Claude/Gemini/OpenAI) — coloca o modelo
 *    no papel da marca, com tom de voz, ICP, posicionamento e instruções
 *    custom já cadastradas.
 *  - `brandAssets`: objeto cru com `logoUrl`, `palette`, `fonts` — útil pra
 *    UIs que precisam acessar diretamente (preview de templates, etc.).
 *  - `kitComplete`: indica se o usuário já populou o brand kit o suficiente
 *    pra recomendar provider top-de-linha (Recraft V3 c/ style_id). Quando
 *    `false`, fallback pra Ideogram/DALL-E é o caminho.
 *
 * Aplicado em TODAS as procedures de geração via:
 *   - `src/app/router/nasa-planner/generate-image-from-prompt.ts`
 *   - `src/app/router/nasa-planner/generate-image-from-reference.ts`
 *   - `src/app/router/ia/generate-compose.ts`
 *   - `src/app/router/ia/generate-conversation-summary.ts`
 *   - e demais (sprints 2/3).
 *
 * Quando a org não tem brand fields populados, retorna strings vazias e
 * `kitComplete=false` — a IA segue funcionando, só sem reforço de marca.
 */

export interface BrandContext {
  imagePromptSuffix: string;
  textSystemPrompt: string;
  brandAssets: {
    logoUrl: string | null;
    logoVariants: Record<string, string> | null;
    palette: string[] | null;
    fonts: { heading: string | null; body: string | null };
    slogan: string | null;
    voiceTone: string | null;
    icp: string | null;
    positioning: string | null;
  };
  /**
   * `true` quando o usuário populou o mínimo viável pra justificar uso de
   * provider top de linha (Recraft V3 com brand consistency): logo + paleta
   * + ao menos uma fonte. Quando `false`, recomenda-se Ideogram/Pollinations.
   */
  kitComplete: boolean;
}

const EMPTY_CONTEXT: BrandContext = {
  imagePromptSuffix: "",
  textSystemPrompt: "",
  brandAssets: {
    logoUrl: null,
    logoVariants: null,
    palette: null,
    fonts: { heading: null, body: null },
    slogan: null,
    voiceTone: null,
    icp: null,
    positioning: null,
  },
  kitComplete: false,
};

/**
 * Constrói o brand context. Retorna objeto vazio com `kitComplete=false`
 * se a org não existe ou não tem campos de brand populados — sempre safe
 * pra chamar e concatenar nas chamadas de IA.
 */
export async function buildBrandedContext(
  organizationId: string,
): Promise<BrandContext> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      brandSlogan: true,
      brandIcp: true,
      brandPositioning: true,
      brandVoiceTone: true,
      brandAiInstructions: true,
      brandPaletteHex: true,
      brandFontHeading: true,
      brandFontBody: true,
      brandLogoUrl: true,
      brandLogoVariants: true,
    },
  });
  if (!org) return EMPTY_CONTEXT;

  const palette = Array.isArray(org.brandPaletteHex)
    ? (org.brandPaletteHex as string[]).filter(
        (c): c is string => typeof c === "string" && c.length > 0,
      )
    : null;
  const logoVariants =
    org.brandLogoVariants && typeof org.brandLogoVariants === "object"
      ? (org.brandLogoVariants as Record<string, string>)
      : null;

  const kitComplete =
    !!org.brandLogoUrl &&
    !!palette &&
    palette.length >= 2 &&
    !!org.brandFontHeading;

  // ── Image prompt suffix ────────────────────────────────────────────────
  // Em inglês porque a maioria dos modelos de imagem responde melhor nesse
  // idioma. Mantemos curto pra não estourar limite de prompt (DALL-E é 4k
  // chars). Concatenado no final do prompt do usuário, separado por " · ".
  const imageBits: string[] = [];
  if (palette && palette.length > 0) {
    imageBits.push(`brand palette: ${palette.slice(0, 5).join(", ")}`);
  }
  if (org.brandFontHeading) {
    imageBits.push(`typography style aligned with ${org.brandFontHeading}`);
  }
  if (org.brandPositioning) {
    // Limita 80 chars pra não dominar o prompt.
    imageBits.push(`brand mood: ${org.brandPositioning.slice(0, 80)}`);
  }
  if (org.brandSlogan) {
    imageBits.push(`brand essence: ${org.brandSlogan.slice(0, 60)}`);
  }
  const imagePromptSuffix =
    imageBits.length > 0
      ? ` · Identity guardrails: ${imageBits.join("; ")}. Keep typography legible, professional, modern.`
      : "";

  // ── Text system prompt ─────────────────────────────────────────────────
  // Em português porque o conteúdo gerado é em PT-BR. Estrutura: papel +
  // tom + público + posicionamento + instruções custom. Concatenado ANTES
  // do system prompt existente da procedure (ex: "Você é uma IA que ajuda
  // o usuário a compor mensagens..." vira "Você representa a marca X
  // (tom Y, ICP Z). Você é uma IA que ajuda...").
  const textBits: string[] = [];
  if (org.brandSlogan) {
    textBits.push(`Você representa a marca "${org.brandSlogan}".`);
  }
  if (org.brandVoiceTone) {
    textBits.push(`Tom de voz: ${org.brandVoiceTone}.`);
  }
  if (org.brandIcp) {
    textBits.push(`Público-alvo (ICP): ${org.brandIcp}.`);
  }
  if (org.brandPositioning) {
    textBits.push(`Posicionamento: ${org.brandPositioning}.`);
  }
  if (org.brandAiInstructions) {
    textBits.push(`Instruções específicas da marca: ${org.brandAiInstructions}`);
  }
  const textSystemPrompt =
    textBits.length > 0
      ? `## Identidade da Marca\n${textBits.join(" ")}\n\n`
      : "";

  return {
    imagePromptSuffix,
    textSystemPrompt,
    brandAssets: {
      logoUrl: org.brandLogoUrl ?? null,
      logoVariants,
      palette,
      fonts: {
        heading: org.brandFontHeading ?? null,
        body: org.brandFontBody ?? null,
      },
      slogan: org.brandSlogan ?? null,
      voiceTone: org.brandVoiceTone ?? null,
      icp: org.brandIcp ?? null,
      positioning: org.brandPositioning ?? null,
    },
    kitComplete,
  };
}

/**
 * Helper de uso fácil pra prompts de imagem. Concatena `userPrompt` +
 * suffix com brand context. Quando a org não tem brand, retorna
 * `userPrompt` inalterado.
 */
export function appendBrandToImagePrompt(
  userPrompt: string,
  ctx: BrandContext,
): string {
  if (!ctx.imagePromptSuffix) return userPrompt;
  return `${userPrompt}${ctx.imagePromptSuffix}`;
}

/**
 * Helper de uso fácil pra system prompts de texto. Prefixa o system com
 * o bloco de identidade da marca. Quando a org não tem brand, retorna
 * `systemPrompt` inalterado.
 */
export function prependBrandToTextSystem(
  systemPrompt: string,
  ctx: BrandContext,
): string {
  if (!ctx.textSystemPrompt) return systemPrompt;
  return `${ctx.textSystemPrompt}${systemPrompt}`;
}
