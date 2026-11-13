// O que cada bloco mostra no cartão do editor do FlowAstro (spec 0139): o conteúdo, não um resumo técnico.
import { ATTENDANCE_ENTRY_LABELS, parseAttendanceEntry } from "./entry-rules";
import { ANSWER_TYPE_LABELS, parseAiAgent, parseAskQuestion, parseColumnMove, parsePromoLookup, parsePromoReceipt, parseRandomizerPaths } from "./nodes";

export interface PreviewLine {
  text: string;
  isEmpty?: boolean;
}

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {};
}

function line(text: string, emptyText: string): PreviewLine {
  return text.trim() ? { text: text.trim() } : { text: emptyText, isEmpty: true };
}

const WAIT_UNIT_LABELS: Record<string, string> = { minutes: "minuto(s)", hours: "hora(s)", days: "dia(s)" };

export function blockPreview(nodeType: string, data: unknown): PreviewLine[] {
  const fields = asFields(data);
  switch (nodeType) {
    case "ATTENDANCE_START": {
      const entry = parseAttendanceEntry(data);
      const keywords = entry.mode === "KEYWORD" && entry.keywords.length > 0 ? `\n${entry.keywords.join(", ")}` : "";
      return [{ text: `${ATTENDANCE_ENTRY_LABELS[entry.mode]}${keywords}` }];
    }
    case "SEND_MESSAGE": {
      const payload = asFields(asFields(fields.action).payload);
      if (payload.type === "BUTTONS") return [line(String(payload.message ?? payload.bodyText ?? ""), "Insira o seu texto")];
      if (payload.type === "IMAGE") return [line(String(payload.caption ?? "") || (payload.imageUrl ? "Imagem" : ""), "Escolha a imagem")];
      if (payload.type === "AUDIO") return [line(payload.audioUrl ? `Áudio: ${String(payload.fileName ?? "") || "arquivo"}` : "", "Escolha o áudio")];
      if (payload.type === "DOCUMENT") return [line(String(payload.fileName ?? "") || (payload.documentUrl ? "Arquivo" : ""), "Escolha o arquivo")];
      return [line(String(payload.message ?? ""), "Insira o seu texto")];
    }
    case "ASK_QUESTION": {
      const config = parseAskQuestion(data);
      return [line(config.question, "Digite sua pergunta"), { text: `Resposta: ${ANSWER_TYPE_LABELS[config.answerType]}` }];
    }
    case "RANDOMIZER":
      return [{ text: `${parseRandomizerPaths(data).length} caminhos` }];
    case "WAIT": {
      const action = asFields(fields.action);
      const unit = String(action.type ?? "minutes").toLowerCase();
      return [{ text: `Esperar ${Number(action[unit] ?? 0)} ${WAIT_UNIT_LABELS[unit] ?? unit}` }];
    }
    case "CALL_WORKFLOW":
      return [line(String(fields.workflowName ?? ""), "Selecione o fluxo")];
    case "AI_AGENT": {
      const config = parseAiAgent(data);
      return [line(config.goal || config.instructions, "Defina o objetivo da IA")];
    }
    case "DISTRIBUTE":
      return [{ text: "Rodízio de atendentes do número" }];
    case "TAG": {
      const action = asFields(fields.action);
      const count = Array.isArray(action.tagsIds) ? action.tagsIds.length : 0;
      return [line(count > 0 ? `${action.type === "REMOVE" ? "Tirar" : "Adicionar"} ${count} etiqueta(s)` : "", "Selecione as etiquetas")];
    }
    case "FINISH_ATTENDANCE": {
      const { endFlow, columns } = parseColumnMove(data);
      const moved = Object.keys(columns).length;
      if (endFlow) return [{ text: moved > 0 ? `Encerra o fluxo e move de coluna` : "Encerra o fluxo do lead" }];
      return [line(moved > 0 ? `Coluna definida em ${moved} número(s)` : "", "Escolha a coluna de cada número")];
    }
    case "PROMO_ENROLL":
      return [{ text: "Regras com Aceito / Não aceito" }];
    case "PROMO_RECEIPT": {
      const config = parsePromoReceipt(data);
      return [{ text: config.sendDefaultReply ? "Responde com a mensagem da promoção" : "Sem resposta automática: use as variáveis" }];
    }
    case "PROMO_LOOKUP":
      return [{ text: parsePromoLookup(data).askPhone ? "Pede o celular e grava os pontos" : "Grava os pontos sem pedir o celular" }];
    default:
      return [];
  }
}
