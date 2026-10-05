import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { NoAiProviderError, resolvePrimaryModel } from "@/features/ia/lib/router/resolve-model";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";

/**
 * "Colar roteiro da semana" (spec 0067, RF-3): o Astro separa um roteiro em texto livre em conteúdos
 * por dia, sem reescrever — só organiza o que o usuário colou.
 */

const weeklyItemSchema = z.object({
  weekday: z.number().int().min(0).max(6).describe("Dia da semana: 0 = domingo, 1 = segunda … 6 = sábado."),
  format: z.enum(["STATIC", "CAROUSEL", "REEL", "STORY"]).describe("STATIC = post de feed com uma imagem."),
  title: z.string().describe("Tema do conteúdo. Sem \"Tema\" no texto, use a frase de \"Conteúdo principal\" da tabela. Nunca vazio."),
  objective: z.string().describe("Objetivo / gatilho do dia, como está no texto (ex.: Dor + identificação + perda). Vazio se não houver."),
  caption: z.string().describe("Tudo que vem depois de \"Descrição\" ou \"Legenda\" no detalhe do dia, copiado inteiro. Vazio se não houver."),
  script: z.string().describe("Roteiro copiado do texto: abertura, cenas, narração, slides ou telas, tela final, com as quebras de linha. NÃO inclua a parte \"Descrição\"/\"Legenda\", que vai em caption."),
  cta: z.string().describe("Chamada para ação do dia (coluna CTA da tabela). Vazio se não houver."),
});

export type WeeklyScriptItem = z.infer<typeof weeklyItemSchema>;

export async function parseWeeklyScript(input: { organizationId: string; userId: string; text: string }) {
  let resolved;
  try {
    resolved = await resolvePrimaryModel({ organizationId: input.organizationId, tier: "SMART", requires: { json: true } });
  } catch (error) {
    if (error instanceof NoAiProviderError) throw new ORPCError("BAD_REQUEST", { message: "Configure uma IA nos Satélites (OpenAI, Gemini ou Anthropic) para o Astro separar o roteiro." });
    throw error;
  }
  if (resolved.keySource !== "organization") {
    const charge = await chargeStarsByAction(input.organizationId, "astro_prompt", { userId: input.userId, description: "Astro IA — roteiro da semana do Planner", appSlug: "nasa-planner" });
    if (!charge.skipped && !charge.success) throw new ORPCError("BAD_REQUEST", { message: "Saldo de Stars insuficiente para o Astro separar o roteiro." });
  }

  const result = await generateObject({
    model: resolved.model,
    schema: z.object({ items: z.array(weeklyItemSchema) }),
    system: [
      "Você organiza um roteiro semanal de redes sociais em conteúdos separados, um por publicação.",
      "Regras: NÃO reescreva, resuma nem invente. Copie o texto do usuário para os campos certos.",
      "Um dia com dois formatos (ex.: Stories + Reel curto) vira dois itens. Uma sequência de Stories do mesmo dia é um item só (as telas vão no roteiro).",
      "Se houver uma tabela-resumo e, depois, o detalhe por dia, junte os dois: objetivo e CTA da tabela, roteiro e descrição do detalhe.",
      "Legenda (caption) é só o texto sob \"Descrição\" ou \"Legenda\" no detalhe do dia, e ele não entra no roteiro. A frase da coluna \"Conteúdo principal\" da tabela não é legenda: use como título quando o dia não tiver \"Tema\".",
      "O CTA da tabela vale para todos os itens do mesmo dia.",
      "Ignore textos gerais de estratégia que não pertencem a um dia.",
    ].join("\n"),
    prompt: input.text,
    temperature: 0,
  });
  return { items: result.object.items };
}
