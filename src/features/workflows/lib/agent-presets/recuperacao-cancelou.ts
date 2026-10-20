/**
 * Preset "Recuperar quem cancelou" (spec 0113, RF-19): a etiqueta de sistema "Cancelou" (cancelamento pelo
 * cliente ou "Cancelou" no cartão do agendamento) dispara uma mensagem curta da IA, escrita a partir do resumo
 * do atendimento, uma hora antes de a janela de 24 h fechar.
 *
 *   LEAD_TAGGED("Cancelou") → WAIT (até 60 min antes de fechar a janela)
 *                           → AI_GENERATE_TEXT (retoma o interesse e oferece remarcar)
 *                           → SEND_MESSAGE (fora da janela usa o modelo reserva escolhido no editor)
 */
import { NodeType } from "@/generated/prisma/enums";
import type { Blueprint } from "./create-from-blueprint";

export const RECOVERY_TRIGGER_TAG_SLUG = "cancelou";
const MINUTES_BEFORE_WINDOW_CLOSES = 60;
// O horário perdido vem de `agendamentosCliente`: o resumo do atendimento pode citar outra consulta, ainda marcada.
export const RECOVERY_PROMPT =
  "O cliente {{lead.name}} cancelou ou não veio a um horário. O horário perdido é o da linha \"Cancelou\" ou \"Não veio\" em agendamentosCliente; fale só dele. Nunca trate como perdido um horário de \"Ainda marcado\" e não ofereça remarcar esse. Use resumoAtendimento, se houver, só para lembrar o que ele queria. Escreva no máximo 2 frases curtas, chamando só pelo primeiro nome, e ofereça um novo horário. Sem cobrança, sem pedir desculpas demais, sem explicar regras.";

export interface RecuperacaoCancelouParams {
  organizationId: string;
  trackingId: string;
  name?: string;
}

export function buildRecuperacaoCancelouBlueprint(params: RecuperacaoCancelouParams): Blueprint {
  const ids = {
    trigger: "trg-cancelou",
    waitWindow: "ctl-wait-window",
    writeMessage: "ai-gen-recuperacao",
    sendMessage: "act-send-recuperacao",
  } as const;

  return {
    name: params.name ?? "Recuperar quem cancelou",
    description:
      "Etiqueta \"Cancelou\" → espera até 1 h antes de fechar a janela de 24 h → a IA escreve a partir do resumo do atendimento e oferece remarcar. Escolha um modelo reserva no envio para quando a janela já tiver fechado.",
    nodes: [
      {
        id: ids.trigger,
        type: NodeType.LEAD_TAGGED,
        position: { x: 0, y: 0 },
        data: { action: { tagIds: [`{{TAG:${RECOVERY_TRIGGER_TAG_SLUG}:Cancelou}}`], conditions: [] } },
      },
      {
        id: ids.waitWindow,
        type: NodeType.WAIT,
        position: { x: 280, y: 0 },
        data: { action: { type: "BEFORE_WINDOW_CLOSES", minutesBefore: MINUTES_BEFORE_WINDOW_CLOSES } },
      },
      {
        id: ids.writeMessage,
        type: NodeType.AI_GENERATE_TEXT,
        position: { x: 560, y: 0 },
        data: {
          organizationId: params.organizationId,
          tone: "leve, natural e direto",
          prompt: RECOVERY_PROMPT,
          maxTokens: 160,
        },
      },
      {
        id: ids.sendMessage,
        type: NodeType.SEND_MESSAGE,
        position: { x: 840, y: 0 },
        data: { action: { payload: { type: "TEXT", message: "{{vars.lastGeneratedText}}" } } },
      },
    ],
    edges: [
      { fromNodeId: ids.trigger, toNodeId: ids.waitWindow },
      { fromNodeId: ids.waitWindow, toNodeId: ids.writeMessage },
      { fromNodeId: ids.writeMessage, toNodeId: ids.sendMessage },
    ],
  };
}
