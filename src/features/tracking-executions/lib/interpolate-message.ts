/**
 * Substituição de variáveis em messageTemplate dos executors da
 * categoria "Adicionar Lead no App".
 *
 * Suporta o mesmo conjunto de variáveis globais que `sendMessageExecutor`
 * já usa (`{{nome}}`, `{{email}}`, `{{phone}}`, `{{data}}`, etc) + extra
 * variáveis app-specific passadas pelo caller (`{{form_nome}}`,
 * `{{valor}}`, `{{produtos}}`, etc).
 *
 * Helper centraliza a lógica que estava inline no `sendMessageExecutor`
 * pra evitar duplicação nos 7 novos executors.
 */

import dayjs from "dayjs";
import {
  colorsByTemperature,
  LeadSourceColors,
} from "@/features/tracking-chat/utils/card-lead";

export interface LeadForInterpolation {
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date | string;
  temperature: string;
  source: string;
  tracking: { name: string };
  status: { name: string };
  publicToken?: string | null;
  responsible?: { name: string } | null;
}

/**
 * Monta o objeto de variáveis globais (mesmo conjunto do SEND_MESSAGE
 * atual). Retorna um Record<string, string> prontamente usável em
 * `applyVariables`.
 */
export function buildLeadVariables(
  lead: LeadForInterpolation,
): Record<string, string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return {
    "{{name}}": lead.name,
    "{{nome}}": lead.name,
    "{{email}}": lead.email || "",
    "{{phone}}": lead.phone || "",
    "{{contato}}": lead.phone || "",
    "{{data}}": dayjs(lead.createdAt).format("DD/MM/YYYY"),
    "{{data-t}}": dayjs(lead.createdAt).format("DD/MM/YYYY HH:mm"),
    "{{temp}}":
      colorsByTemperature[lead.temperature as keyof typeof colorsByTemperature]
        ?.label || lead.temperature,
    "{{fonte}}":
      LeadSourceColors[lead.source as keyof typeof LeadSourceColors]?.label ||
      lead.source,
    "{{track}}": lead.tracking.name,
    "{{status}}": lead.status.name,
    "{{public_link}}": lead.publicToken
      ? `${baseUrl}/public/lead/${lead.publicToken}`
      : "",
    "{{responsavel}}": lead.responsible?.name ?? "",
  };
}

/**
 * Aplica substituição global em `text` usando as variáveis fornecidas.
 * Usa `replaceAll` (string método) — substitui TODAS as ocorrências de
 * cada chave.
 */
export function applyVariables(
  text: string,
  variables: Record<string, string>,
): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(key).join(value ?? "");
  }
  return result;
}

/**
 * Atalho que combina build + apply quando você só tem o lead.
 */
export function interpolateLeadMessage(
  template: string,
  lead: LeadForInterpolation,
  extraVariables?: Record<string, string>,
): string {
  const variables = {
    ...buildLeadVariables(lead),
    ...(extraVariables ?? {}),
  };
  return applyVariables(template, variables);
}
