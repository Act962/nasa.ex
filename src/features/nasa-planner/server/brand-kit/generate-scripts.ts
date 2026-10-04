import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { NoAiProviderError, resolvePrimaryModel } from "@/features/ia/lib/router/resolve-model";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import type { NasaPlannerPostType } from "@/generated/prisma/enums";
import { buildBrandKitPrompt, getBrandKit } from "./brand-kit";

/**
 * "Gerar com o Astro" (spec 0063, RF-5/RF-6): um roteiro por formato a partir de uma ideia,
 * pela IA do Astro (chave da empresa ou da plataforma). Kit incompleto é recusado aqui também.
 */

const FORMAT_GUIDE: Record<NasaPlannerPostType, string> = {
  STATIC: "Feed (1 imagem quadrada ou 4:5): uma arte com frase curta de impacto.",
  CAROUSEL: "Carrossel (5 a 7 cards): cada card com um título curto; o último é o CTA.",
  REEL: "Reel vertical de 15 a 30 s: cenas com tempo (gancho nos 3 primeiros segundos), fala/legenda na tela e CTA no fim.",
  STORY: "Story vertical: 1 a 3 telas, texto direto na arte (Story não mostra legenda), CTA curto.",
};

const formatScriptSchema = z.object({
  title: z.string().describe("Título interno do post, curto."),
  script: z.string().describe("Roteiro do formato: cards do carrossel, cenas do reel ou telas do story, uma por linha."),
  caption: z.string().describe("Legenda completa pronta para publicar: 2 a 4 frases no tom da marca, terminando com o CTA. Obrigatória (no Story, o texto que vai na arte)."),
  hashtags: z.array(z.string()).describe("De 3 a 8 hashtags, sem o #, incluindo as da marca."),
  cta: z.string().describe("Chamada para ação."),
  artDirection: z.string().describe("Direção de arte usando os logos, cores, fontes e fundos do kit."),
});

export type GeneratedFormatScript = z.infer<typeof formatScriptSchema> & { format: NasaPlannerPostType };

/** Um campo fixo por formato pedido: o modelo não precisa ecoar o formato (e não erra o nome dele). */
function buildGenerationSchema(formats: NasaPlannerPostType[]) {
  return z.object(Object.fromEntries(formats.map((format) => [format, formatScriptSchema])) as Record<NasaPlannerPostType, typeof formatScriptSchema>);
}

export async function generatePlannerScripts(input: { organizationId: string; userId: string; idea: string; formats: NasaPlannerPostType[] }) {
  const kit = await getBrandKit(input.organizationId);
  if (!kit.completeness.isComplete) {
    throw new ORPCError("BAD_REQUEST", { message: `Kit da marca incompleto. Falta: ${kit.completeness.missing.join(", ")}.` });
  }

  let resolved;
  try {
    resolved = await resolvePrimaryModel({ organizationId: input.organizationId, tier: "SMART", requires: { json: true } });
  } catch (error) {
    if (error instanceof NoAiProviderError) throw new ORPCError("BAD_REQUEST", { message: "Configure uma IA nos Satélites (OpenAI, Gemini ou Anthropic) para gerar com o Astro." });
    throw error;
  }

  // Chave da plataforma cobra como um prompt do Astro; chave da própria empresa não cobra.
  if (resolved.keySource !== "organization") {
    const charge = await chargeStarsByAction(input.organizationId, "astro_prompt", {
      userId: input.userId,
      description: "Astro IA — roteiro do Planner",
      appSlug: "nasa-planner",
    });
    if (!charge.skipped && !charge.success) throw new ORPCError("BAD_REQUEST", { message: "Saldo de Stars insuficiente para gerar com o Astro." });
  }

  const result = await generateObject({
    model: resolved.model,
    schema: buildGenerationSchema(input.formats),
    system: [
      "Você é o Astro, estrategista de conteúdo do ÓRBITA. Escreve em português do Brasil, no tom da marca, sem inventar produto, preço ou dado que não esteja no kit.",
      "Kit da marca:",
      buildBrandKitPrompt(kit),
    ].join("\n\n"),
    prompt: [
      `Ideia do conteúdo: ${input.idea}`,
      "Crie um roteiro para cada formato abaixo (um campo por formato), com a mesma ideia adaptada ao formato. Preencha a legenda de todos:",
      ...input.formats.map((format) => `- ${format}: ${FORMAT_GUIDE[format]}`),
    ].join("\n"),
    temperature: 0.7,
  });

  const generatedByFormat = result.object as Partial<Record<NasaPlannerPostType, z.infer<typeof formatScriptSchema>>>;
  return {
    scripts: input.formats
      .filter((format) => generatedByFormat[format])
      .map((format): GeneratedFormatScript => ({ format, ...generatedByFormat[format]! })),
    model: { provider: resolved.provider, modelId: resolved.modelId },
  };
}
