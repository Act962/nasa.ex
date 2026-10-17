import "server-only";
import prisma from "@/lib/prisma";
import {
  applyVariables,
  buildLeadVariables,
} from "@/features/tracking-executions/lib/interpolate-message";
import { interpolate, type WorkflowContext } from "../workflow-context";

// Só caminhos com ponto ({{lead.name}}, {{vars.sei.protocolo}}): as variáveis do modo normal
// ({{nome}}, {{data-t}}) não têm ponto e ficam para quem conhece cada uma.
const AGENT_PATH_PLACEHOLDER = /\{\{\s*[A-Za-z_][\w-]*(?:\.[\w-]+|\[\d+\])+\s*\}\}/g;

/** Preenche os campos do Modo Agente num `data` que vai para um executor do modo normal. */
export function fillAgentPlaceholders<T>(context: WorkflowContext, value: T): T {
  if (typeof value === "string") {
    return value.replace(AGENT_PATH_PLACEHOLDER, (placeholder) =>
      interpolate(context, placeholder),
    ) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => fillAgentPlaceholders(context, item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        fillAgentPlaceholders(context, item),
      ]),
    ) as T;
  }
  return value;
}

/**
 * Preenchimento de texto do "Enviar Mensagem" no Modo Agente: as variáveis da janela do editor
 * ({{nome}}, {{status}}, {{sei_protocolo}}…), iguais às do modo normal, e as do Modo Agente
 * ({{lead.name}}, {{vars.x}}). Lê o lead na hora, para coluna e funil saírem atualizados.
 * `null` quando o lead não existe mais.
 */
export async function createMessageFiller(
  context: WorkflowContext,
  leadId: string,
): Promise<((text: string) => string) | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      status: { select: { name: true } },
      tracking: { select: { name: true } },
      responsible: { select: { name: true } },
    },
  });
  if (!lead) return null;

  const sei = (context.vars?.sei ?? {}) as Record<string, unknown>;
  const variables = {
    ...buildLeadVariables(lead),
    "{{sei_protocolo}}": String(sei.protocolo ?? ""),
    "{{sei_andamento}}": String(sei.ultimoAndamento ?? ""),
    "{{sei_especificacao}}": String(sei.especificacao ?? ""),
    "{{sei_link}}": String(sei.linkAcesso ?? ""),
  };
  return (text) => interpolate(context, applyVariables(text, variables));
}
