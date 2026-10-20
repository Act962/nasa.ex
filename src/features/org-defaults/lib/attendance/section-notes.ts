import "server-only";
import { findOpenSection, listClosedSections, patchSection } from "./section";

// Anotações da seção (spec 0113, RF-14): a própria resposta da IA traz o resumo num bloco `<notas>`, que é
// separado antes do envio. Nenhuma chamada extra de IA.

export const MAX_SECTION_SUMMARY_UPDATES = 6;
const PREVIOUS_SECTIONS_IN_CONTEXT = 3;
const CLOSED_NOTES_BLOCK = /<notas>([\s\S]*?)<\/notas>/gi;
const TRAILING_NOTES_BLOCK = /<notas>([\s\S]*)$/i;
/** Resumo refeito no máximo a cada 20 min de conversa com a IA, além das entradas pelo atendimento. */
const SUMMARY_REFRESH_MS = 20 * 60_000;
const MAX_SUMMARY_CHARS = 700;

export interface SectionNotesPlan {
  sectionId: string | null;
  summaryCount: number;
  /** Bloco para o system prompt: resumo da seção aberta e uma linha das anteriores. */
  contextBlock: string;
  /** A seção aberta já tem resumo: a IA lê menos histórico (RF-15). */
  hasOpenSummary: boolean;
  shouldWriteNotes: boolean;
}

function oneLine(text: string, maxChars: number): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > maxChars ? `${singleLine.slice(0, maxChars - 1)}…` : singleLine;
}

export async function planSectionNotes(params: { leadId: string; isAttendanceTrigger: boolean }): Promise<SectionNotesPlan> {
  const [openSection, closedSections] = await Promise.all([
    findOpenSection(params.leadId),
    listClosedSections(params.leadId, PREVIOUS_SECTIONS_IN_CONTEXT),
  ]);
  const lines: string[] = [];
  if (openSection?.state.summary) lines.push(`Atendimento atual: ${oneLine(openSection.state.summary, MAX_SUMMARY_CHARS)}`);
  for (const section of closedSections) {
    if (!section.state.summary) continue;
    const openedOn = new Date(section.state.openedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    lines.push(`Atendimento de ${openedOn}: ${oneLine(section.state.summary, 200)}`);
  }
  const summaryCount = openSection?.state.summaryCount ?? 0;
  const summaryUpdatedAt = openSection?.state.summaryUpdatedAt;
  const isSummaryStale = !summaryUpdatedAt || Date.now() - new Date(summaryUpdatedAt).getTime() >= SUMMARY_REFRESH_MS;
  // Atualiza quando a IA entra pelo estado de atendimento, quando não há resumo ou quando ele envelheceu.
  const shouldWriteNotes =
    Boolean(openSection) &&
    summaryCount < MAX_SECTION_SUMMARY_UPDATES &&
    (params.isAttendanceTrigger || !openSection?.state.summary || isSummaryStale);
  return {
    sectionId: openSection?.id ?? null,
    summaryCount,
    contextBlock: lines.length > 0 ? `# Anotações do atendimento\n\n${lines.join("\n")}` : "",
    hasOpenSummary: Boolean(openSection?.state.summary),
    shouldWriteNotes,
  };
}

// Regra de formato à parte e explícita: como frase solta, o modelo a descartava diante do limite de tamanho
// da mensagem ("uma mensagem só, até 2 frases") e nenhuma anotação era gravada.
export const NOTES_INSTRUCTION = [
  "## Anotação interna (OBRIGATÓRIA nesta resposta)",
  "- Depois da mensagem ao cliente, numa linha separada, escreva <notas>resumo do negócio em até 60 palavras: produto de interesse, valor, forma de pagamento, combinado (data, retirada), pendências e como o cliente está</notas>.",
  "- O cliente não vê essa parte, e ela não conta no limite de frases nem de caracteres da mensagem.",
  "- Mesmo no começo da conversa, anote o que já se sabe. Exemplo: <notas>Quer marcar consulta; unidade e data ainda não definidas.</notas>",
  "- Não coloque documento, cartão nem senha.",
].join("\n");

/**
 * Separa os blocos `<notas>` do texto que vai ao cliente. Bloco sem fechamento vai até o fim da resposta e
 * nunca sai: se a resposta inteira estiver nele, o cliente não recebe nada em vez de receber a anotação.
 */
export function splitNotesFromReply(text: string): { replyText: string; notes: string | null } {
  const noteParts: string[] = [];
  let replyText = text.replace(CLOSED_NOTES_BLOCK, (_, noteText: string) => {
    noteParts.push(noteText);
    return "";
  });
  const trailingMatch = replyText.match(TRAILING_NOTES_BLOCK);
  if (trailingMatch && trailingMatch.index !== undefined) {
    noteParts.push(trailingMatch[1] ?? "");
    replyText = replyText.slice(0, trailingMatch.index);
  }
  // Tag solta que sobrou nunca vai ao cliente.
  replyText = replyText.replace(/<\/?notas>/gi, "").trim();
  const notes = oneLine(noteParts.join(" "), MAX_SUMMARY_CHARS);
  return { replyText, notes: notes || null };
}

export async function saveSectionNotes(params: { sectionId: string; notes: string; summaryCount: number }): Promise<void> {
  await patchSection(params.sectionId, {
    summary: params.notes,
    summaryCount: params.summaryCount + 1,
    summaryUpdatedAt: new Date().toISOString(),
  });
}
