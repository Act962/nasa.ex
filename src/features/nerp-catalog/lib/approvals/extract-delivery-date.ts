import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { recordAiUsage } from "@/features/ia/server/record-ai-usage";
import { resolveExtractionModels } from "@/features/payment/server/documents/resolve-extraction-model";

// Spec 0104, D-4: a equipe escreve como fala ("amanhã 11h"); a IA só converte em data. O aprovador
// confere a data na resposta antes de ela chegar ao cliente.

const deliveryReadingSchema = z.object({
  hasDeliveryDate: z.boolean().describe("true se o texto informa quando a entrega acontece"),
  deliveryAtLocal: z
    .string()
    .nullable()
    .describe("Data e hora da entrega no horário de Brasília, formato AAAA-MM-DDTHH:mm. Sem hora dita, use 12:00."),
});

const BRASILIA_OFFSET = "-03:00";

function toBrasiliaNowText(now: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

const CALENDAR_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "quinta-feira 15/10/2026, sexta-feira 16/10/2026, …". Sem a lista o modelo calculava o dia da semana
 * sozinho e errava ("segunda às 10" numa quinta virou sábado).
 */
export function buildCalendarText(now: Date): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return Array.from({ length: CALENDAR_DAYS }, (_, index) => {
    const label = formatter.format(new Date(now.getTime() + index * DAY_MS));
    return index === 0 ? `${label} (hoje)` : index === 1 ? `${label} (amanhã)` : label;
  }).join("\n");
}

export async function extractDeliveryDate(params: {
  organizationId: string;
  text: string;
  now?: Date;
}): Promise<Date | null> {
  const now = params.now ?? new Date();
  const candidates = await resolveExtractionModels(params.organizationId);
  for (const candidate of candidates) {
    try {
      const { object, usage } = await generateObject({
        model: candidate.model,
        schema: deliveryReadingSchema,
        prompt: `Agora é ${toBrasiliaNowText(now)} (horário de Brasília).
Uma pessoa da equipe da loja escreveu sobre a entrega de um pedido. Diga quando a entrega acontece.
Não invente: se o texto não fala de data ou prazo, responda hasDeliveryDate=false.
Dia da semana citado ("segunda", "sexta") é o próximo com esse nome na lista abaixo, a partir de amanhã.
Use SEMPRE a data da lista; não calcule o dia da semana por conta própria.

Próximos dias:
${buildCalendarText(now)}

Texto: """${params.text.slice(0, 500)}"""`,
        maxOutputTokens: 200,
      });
      await recordAiUsage({
        resourceId: "catalog.delivery-date",
        organizationId: params.organizationId,
        provider: candidate.provider,
        modelId: candidate.modelId,
        keySource: candidate.keySource === "integration" ? "organization" : "platform",
        usage,
        starsCharged: 0,
      });
      if (!object.hasDeliveryDate || !object.deliveryAtLocal) return null;
      const parsed = new Date(`${object.deliveryAtLocal.slice(0, 16)}:00${BRASILIA_OFFSET}`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch (error) {
      console.warn(`[nerp-catalog/approvals] leitura do prazo falhou em ${candidate.provider}`, error);
    }
  }
  return null;
}
