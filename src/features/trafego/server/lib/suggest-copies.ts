import "server-only";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { TrafegoPlatform } from "@/generated/prisma/enums";
import type { TrafegoReleaseContent } from "@/features/trafego/lib/release";
import { buildPolicyContext } from "@/features/trafego/lib/ad-policies";

const suggestionsSchema = z.object({
  copies: z
    .array(
      z.object({
        headline: z.string().max(60).describe("Título curto, sem ponto final"),
        primaryText: z.string().max(600).describe("Texto principal do anúncio"),
        description: z.string().max(120).describe("Linha de apoio"),
        callToAction: z.string().max(30).describe("Chamada para ação, ex: Saiba mais"),
        angle: z.string().max(80).describe("Em uma expressão, o ângulo usado"),
      }),
    )
    .length(3),
});

export type SuggestedCopy = z.infer<typeof suggestionsSchema>["copies"][number];

/**
 * Três copies a partir do Release — ângulos diferentes, não três variações da
 * mesma frase. O ruleset de políticas entra no system: é mais barato não
 * escrever a alegação proibida do que bloqueá-la depois.
 */
export async function suggestTrafegoCopies(params: {
  platform: TrafegoPlatform;
  objective: string;
  release: TrafegoReleaseContent;
  businessName?: string | null;
  audience?: string | null;
}): Promise<SuggestedCopy[]> {
  if (!process.env.OPENAI_API_KEY) return [];

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: suggestionsSchema,
      system: [
        "Você escreve anúncios para pequenos negócios brasileiros.",
        "Português do Brasil. Frases curtas. Zero jargão de agência.",
        "Três ângulos DIFERENTES entre si — dor, prova e oferta, por exemplo. Não repita a mesma ideia com outras palavras.",
        "Use somente o que está no Release. Não invente preço, prazo, prêmio, número ou depoimento.",
        "Respeite o campo 'o que não dizer' do Release.",
        "",
        buildPolicyContext(params.platform),
      ].join("\n"),
      prompt: [
        `Plataforma: ${params.platform}`,
        `Objetivo: ${params.objective}`,
        params.businessName ? `Empresa: ${params.businessName}` : null,
        params.audience ? `Público: ${params.audience}` : null,
        "",
        "RELEASE:",
        `Sobre: ${params.release.about}`,
        params.release.products.length ? `Produtos: ${params.release.products.join("; ")}` : null,
        params.release.differentials.length
          ? `Diferenciais: ${params.release.differentials.join("; ")}`
          : null,
        params.release.audience ? `Público do release: ${params.release.audience}` : null,
        params.release.tone ? `Tom: ${params.release.tone}` : null,
        params.release.offers.length ? `Ofertas: ${params.release.offers.join("; ")}` : null,
        params.release.doNotSay.length
          ? `NÃO dizer: ${params.release.doNotSay.join("; ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
      maxRetries: 1,
    });
    return object.copies;
  } catch (error) {
    console.warn("[trafego/copies] sugestão falhou:", error);
    return [];
  }
}
