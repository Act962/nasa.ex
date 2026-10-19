import "server-only";
import { findOpenSection, listClosedSections, patchSection } from "./section";

// Anotações da seção (spec 0113, RF-14): a própria resposta da IA traz o resumo num bloco `<notas>`, que é
// separado antes do envio. Nenhuma chamada extra de IA.

export const MAX_SECTION_SUMMARY_UPDATES = 6;
const PREVIOUS_SECTIONS_IN_CONTEXT = 3;
const NOTES_BLOCK = /<notas>([\s\S]*?)(?:<\/notas>|$)/i;
const MAX_SUMMARY_CHARS = 700;

export interface SectionNotesPlan {
  sectionId: string | null;
  summaryCount: number;
  /** Bloco para o system prompt: resumo da seção aberta e uma linha das anteriores. */
  contextBlock: string;
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
  // Atualiza quando a IA entra pelo estado de atendimento ou quando a seção ainda não tem resumo.
  const shouldWriteNotes =
    Boolean(openSection) &&
    summaryCount < MAX_SECTION_SUMMARY_UPDATES &&
    (params.isAttendanceTrigger || !openSection?.state.summary);
  return {
    sectionId: openSection?.id ?? null,
    summaryCount,
    contextBlock: lines.length > 0 ? `# Anotações do atendimento\n\n${lines.join("\n")}` : "",
    shouldWriteNotes,
  };
}

export const NOTES_INSTRUCTION =
  "Ao final da resposta, numa linha separada, escreva <notas>resumo do negócio em até 60 palavras: produto de interesse, valor, forma de pagamento, combinado (data, retirada), pendências e como o cliente está</notas>. O cliente não vê essa parte. Não coloque documento, cartão nem senha.";

/** Separa o bloco `<notas>` do texto que vai ao cliente. */
export function splitNotesFromReply(text: string): { replyText: string; notes: string | null } {
  const match = text.match(NOTES_BLOCK);
  if (!match) return { replyText: text, notes: null };
  const replyText = text.replace(match[0], "").trim();
  const notes = oneLine(match[1] ?? "", MAX_SUMMARY_CHARS);
  return { replyText, notes: notes || null };
}

export async function saveSectionNotes(params: { sectionId: string; notes: string; summaryCount: number }): Promise<void> {
  await patchSection(params.sectionId, {
    summary: params.notes,
    summaryCount: params.summaryCount + 1,
    summaryUpdatedAt: new Date().toISOString(),
  });
}
