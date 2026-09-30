import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { ASTRO_GUIDES, findGuide } from "@/features/astro-guides/lib/registry";
import { toAstroGuidePayload } from "@/features/astro/lib/astro-guide";

// Guia na tela real (spec 0046, RF-6): o cartão devolvido tem o botão "Me mostre na tela".

const GUIDE_CATALOG = ASTRO_GUIDES.map((guide) => `"${guide.key}" (${guide.title})`).join(", ");

export function buildGuideTools() {
  return {
    start_guide: tool({
      description:
        "Mostra ao usuário um passo a passo NA TELA dele, destacando botões e campos reais com seta e explicação. " +
        "Use quando o usuário quer APRENDER a fazer algo (\"como faço\", \"me ensina\", \"onde clico\") e existe um guia para isso. " +
        `Guias disponíveis: ${GUIDE_CATALOG}. ` +
        "Depois de chamar, responda só uma frase curta convidando a clicar em \"Me mostre na tela\".",
      inputSchema: z.object({
        guideKey: z.enum(ASTRO_GUIDES.map((guide) => guide.key) as [string, ...string[]]),
      }),
      execute: async ({ guideKey }) => {
        const guide = findGuide(guideKey);
        if (!guide) return { error: `Guia ${guideKey} não existe.` };
        return toAstroGuidePayload(guide);
      },
    }),
  };
}
