import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { ParsedEvent } from "./parse-event-html";

/**
 * Extrai metadados de evento de uma imagem (flyer/cartaz/banner)
 * usando Claude Vision via AI SDK. Usa o mesmo schema `ParsedEvent`
 * do parser de URL pra simplificar o fluxo downstream.
 *
 * O modelo precisa:
 *  - Identificar título e descrição do evento
 *  - Achar datas em qualquer formato (texto livre comum em flyers:
 *    "15 e 16 de maio", "DIA 20/05", "TERÇA 14H", etc)
 *  - Detectar cidade/estado/endereço quando presentes
 *  - Identificar URLs/contatos (Instagram, telefone) — vão pra
 *    registrationUrl quando há link explícito
 *
 * Sem libs novas — usa `@ai-sdk/anthropic` que já está em package.json.
 * `generateObject` com schema Zod garante output estruturado (o modelo
 * é forçado a devolver JSON válido no formato esperado).
 */

const eventSchema = z.object({
  title: z.string().nullable().describe(
    "Título do evento, geralmente em destaque no flyer. Ignore tags como 'Curso Online', 'Workshop' etc. — pegue só o nome do evento em si.",
  ),
  description: z.string().nullable().describe(
    "Descrição curta (1-3 frases) sobre o que é o evento. Use o texto explicativo do flyer; ignore call-to-actions tipo 'Inscreva-se'.",
  ),
  startDate: z.string().nullable().describe(
    "Data de início no formato ISO 8601 (YYYY-MM-DDTHH:mm:ss.000Z). Quando o ano não está explícito, assuma o ano atual ou próximo. Quando só há um dia, mesmo formato.",
  ),
  endDate: z.string().nullable().describe(
    "Data de fim no formato ISO 8601 quando o evento dura mais de 1 dia (ex: '15 e 16 de maio' → end=16). Igual ao startDate quando é evento de 1 dia só.",
  ),
  city: z.string().nullable().describe(
    "Cidade do evento (ex: 'São Paulo'). null se for evento online ou não mencionar.",
  ),
  state: z.string().nullable().describe(
    "UF do estado (2 letras, ex: 'SP'). null se for evento online ou não mencionar.",
  ),
  address: z.string().nullable().describe(
    "Endereço físico completo (rua, número, bairro). null se for evento online.",
  ),
  registrationUrl: z.string().nullable().describe(
    "URL pra inscrição/saber mais quando explícita no flyer. Se só houver Instagram (@usuario), retorne null — o user pode adicionar depois.",
  ),
  eventCategory: z
    .enum([
      "WORKSHOP",
      "PALESTRA",
      "LANCAMENTO",
      "WEBINAR",
      "NETWORKING",
      "CURSO",
      "REUNIAO",
      "HACKATHON",
      "CONFERENCIA",
      "OUTRO",
    ])
    .nullable()
    .describe(
      "Categoria que melhor descreve o evento baseado no flyer. 'CURSO' pra cursos/aulas, 'WORKSHOP' pra oficinas práticas, 'WEBINAR' pra eventos online ao vivo, etc.",
    ),
});

/**
 * Recebe os bytes da imagem (Buffer ou Uint8Array) + content-type
 * e a API key da Anthropic. Devolve `ParsedEvent` no mesmo schema
 * do parser de URL. Falhas viram `null`.
 */
export async function extractEventFromImage(
  imageBytes: Uint8Array,
  contentType: string,
  apiKey: string,
): Promise<(ParsedEvent & { eventCategory?: string | null }) | null> {
  try {
    const anthropic = createAnthropic({ apiKey });

    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: eventSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analise este flyer/banner de evento e extraia as informações estruturadas no formato JSON fornecido. " +
                "Use português brasileiro pra strings. Use null pra campos não-presentes (não invente). " +
                "Pra datas, devolva ISO 8601 — se o ano não está claro, use o ano atual ou próximo.",
            },
            {
              type: "image",
              image: imageBytes,
              mediaType: contentType,
            },
          ],
        },
      ],
      maxOutputTokens: 800,
    });

    // Normaliza pro shape de ParsedEvent + categoria
    return {
      title: object.title,
      description: object.description,
      startDate: object.startDate,
      endDate: object.endDate,
      imageUrl: null, // Imagem fonte vai virar cover via upload separado
      city: object.city,
      state: object.state,
      address: object.address,
      registrationUrl: object.registrationUrl,
      eventCategory: object.eventCategory,
    };
  } catch (err) {
    console.error("[extractEventFromImage]", err);
    return null;
  }
}
