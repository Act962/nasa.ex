// Recorte do documento de roteiro por assunto (spec 0091). O documento inteiro tem dezenas de
// respostas por assunto; mandar tudo ao modelo a cada mensagem custa caro e não ajuda. Aqui, sem IA,
// ficam as informações gerais e só os assuntos que estão em pauta na conversa.

export interface KnowledgeFocus {
  /** Nomes das tags do lead (ex.: "Interesse: Cirurgia de Catarata"). */
  tagNames: string[];
  /** O que o cliente escreveu nas últimas mensagens. */
  recentText: string;
}

const SCRIPT_SOURCE_PREFIX = "> Origem: roteiro de atendimento";
export const TOPIC_HINT_PREFIX = "> Quando:";
const GENERAL_HEADING = "informacoes gerais";
/** Palavras que aparecem em quase todo assunto e por isso não distinguem nenhum. */
const GENERIC_WORDS = new Set([
  "cirurgia", "cirurgias", "tratamento", "procedimento", "consulta", "avaliacao", "cliente", "escolheu", "perguntou", "sobre",
  "para", "pelo", "pela", "com", "por", "dos", "das", "nos", "nas", "uma", "que", "olho", "olhos", "ocular", "laser",
]);
const MIN_WORD_CHARS = 3;

export function isScriptKnowledge(content: string): boolean {
  return content.startsWith(SCRIPT_SOURCE_PREFIX);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function keywords(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_WORD_CHARS && !GENERIC_WORDS.has(word));
}

interface Section {
  heading: string;
  lines: string[];
}

function splitSections(content: string): { preamble: string[]; sections: Section[] } {
  const preamble: string[] = [];
  const sections: Section[] = [];
  for (const line of content.split("\n")) {
    if (line.startsWith("## ")) sections.push({ heading: line.slice(3).trim(), lines: [] });
    else if (sections.length > 0) sections[sections.length - 1].lines.push(line);
    else preamble.push(line);
  }
  return { preamble, sections };
}

/**
 * Informações gerais + os assuntos em pauta. Assunto entra quando o lead tem a tag de interesse dele
 * ou quando o cliente citou alguma palavra dele. Os demais viram só uma linha com o nome, para a
 * assistente saber que existem e perguntar qual o cliente quer.
 */
export function focusScriptKnowledge(content: string, focus: KnowledgeFocus): string {
  const { preamble, sections } = splitSections(content);
  const spoken = new Set(keywords(`${focus.tagNames.join(" ")} ${focus.recentText}`));
  const kept: Section[] = [];
  const leftOut: string[] = [];
  for (const section of sections) {
    const isGeneral = normalize(section.heading) === GENERAL_HEADING;
    const hint = section.lines.find((line) => line.startsWith(TOPIC_HINT_PREFIX)) ?? "";
    const isInFocus = keywords(`${section.heading} ${hint}`).some((word) => spoken.has(word));
    if (isGeneral || isInFocus) kept.push(section);
    else leftOut.push(section.heading);
  }
  const parts = [...preamble, ...kept.flatMap((section) => [`## ${section.heading}`, ...section.lines])];
  if (leftOut.length > 0) {
    parts.push(
      "",
      "## Outros assuntos",
      `Há informações também sobre: ${leftOut.join("; ")}. Se o cliente perguntar por um deles, pergunte de qual assunto ele quer saber antes de responder.`,
    );
  }
  return parts.join("\n");
}
