import { resolveAiFor } from "@/features/ia/server/resolve-ai-for";
import { recordAiUsage } from "@/features/ia/server/record-ai-usage";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { generateText } from "ai";
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
    const resolvedAi = await resolveAiFor({ resourceId: "insights.narrative", organizationId: context.org.id, provider: "anthropic", modelId: "claude-haiku-4-5-20251001" }).catch(() => null);
    if (!resolvedAi) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "ANTHROPIC_API_KEY não configurada",
      });
    }

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

    const { text, usage } = await generateText({
      model: resolvedAi.model,
      system:
        "Você é um analista operacional sênior. Gera diagnósticos curtos, específicos e acionáveis a partir de indicadores cruzados de uma empresa.",
      prompt,
      maxOutputTokens: 220,
      temperature: 0.4,
    });

    await recordAiUsage({ resourceId: "insights.narrative", organizationId: context.org.id, userId: context.user.id, provider: "anthropic", modelId: "claude-haiku-4-5", keySource: resolvedAi.keySource, usage });

    return { narrative: text.trim() };
  });
