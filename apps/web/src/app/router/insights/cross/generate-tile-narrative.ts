import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ORPCError } from "@orpc/server";

const severityEnum = z.enum(["good", "warn", "bad", "neutral"]);
const unitEnum = z.enum(["count", "percent", "currency"]);

export const generateTileNarrative = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      tileId: z.string(),
      title: z.string(),
      primaryValue: z.number(),
      secondaryValue: z.number().optional(),
      delta: z.number().nullable(),
      severity: severityEnum,
      unit: unitEnum.optional(),
      ruleNarrative: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "ANTHROPIC_API_KEY não configurada",
      });
    }

    const anthropic = createAnthropic({ apiKey });

    const fmt = (v: number) => {
      if (input.unit === "currency") {
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        }).format(v);
      }
      if (input.unit === "percent") return `${v.toFixed(1)}%`;
      return new Intl.NumberFormat("pt-BR").format(v);
    };

    const deltaStr =
      input.delta == null
        ? "sem dado anterior"
        : `${input.delta > 0 ? "+" : ""}${input.delta.toFixed(1)}%`;

    const prevStr =
      input.secondaryValue != null ? fmt(input.secondaryValue) : "—";

    const severityLabel = {
      good: "destaque positivo",
      warn: "ponto de atenção",
      bad: "alerta crítico",
      neutral: "neutro",
    }[input.severity];

    const prompt = `Empresa: ${context.org.name}
Indicador: ${input.title}
Valor atual: ${fmt(input.primaryValue)}
Valor anterior: ${prevStr}
Variação: ${deltaStr}
Classificação: ${severityLabel}
${input.ruleNarrative ? `Análise base: ${input.ruleNarrative}` : ""}

Gere 2 linhas em português do Brasil:
- Linha 1: diagnóstico operacional (o que está acontecendo).
- Linha 2: ação recomendada concreta (o que fazer agora).

Sem títulos, sem markdown. Direto, profissional e específico.`;

    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system:
        "Você é um analista operacional sênior. Gera diagnósticos curtos, específicos e acionáveis a partir de indicadores cruzados de uma empresa.",
      prompt,
      maxOutputTokens: 220,
      temperature: 0.4,
    });

    return { narrative: text.trim() };
  });
