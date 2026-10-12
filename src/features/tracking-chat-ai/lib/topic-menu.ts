// Menu de perguntas por assunto (spec 0096): depois de escolher um assunto, o cliente recebe as
// perguntas mais comuns dele como opções, e a resposta sai do roteiro, pelo código, sem IA. Puro: o
// documento do roteiro entra como texto e sai como menus prontos para gravar.

export const TOPIC_MENU_NAME_PREFIX = "Perguntas: ";
export const TOPIC_OPTION_PREFIX = "tq:";
/** Cliques que o menu de botões do atendimento já resolve sem IA (spec 0089). */
const BOOK_OPTION = { id: "cli:book", text: "Agendar avaliação" };
const HUMAN_OPTION = { id: "cli:human", text: "Falar com atendente" };

export const TOPIC_MENU_LIMITS = { maxQuestions: 6, minQuestions: 2, titleChars: 24, bodyChars: 1024, answerChars: 850 } as const;
export const TOPIC_MENU_ASK = "O que você quer saber?";
export const TOPIC_MENU_ASK_AGAIN = "Quer saber mais alguma coisa?";

const GENERAL_HEADING = "informacoes gerais";
const FACT_LINE = /^- \*\*(.+?)\*\*\s*(.+)$/;

export interface TopicFact {
  question: string;
  answer: string;
}

export interface TopicFacts {
  topicName: string;
  facts: TopicFact[];
}

export interface TopicMenuButton {
  id: string;
  text: string;
  /** Resposta pronta, enviada pelo código quando o cliente escolhe esta opção. Ausente nas linhas de ação. */
  answer?: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Os assuntos do documento do roteiro, com as perguntas e respostas de cada um. Sem IA. */
export function parseTopicFacts(scriptKnowledge: string): TopicFacts[] {
  const topics: TopicFacts[] = [];
  for (const line of scriptKnowledge.split("\n")) {
    if (line.startsWith("## ")) {
      topics.push({ topicName: line.slice(3).trim(), facts: [] });
      continue;
    }
    const fact = line.match(FACT_LINE);
    if (fact && topics.length > 0) topics[topics.length - 1].facts.push({ question: fact[1].trim(), answer: fact[2].trim() });
  }
  return topics.filter((topic) => normalize(topic.topicName) !== GENERAL_HEADING);
}

/** Corta no fim de uma frase, para a resposta não acabar no meio de uma palavra. */
export function clipAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "), cut.lastIndexOf("; "));
  return lastSentenceEnd > maxChars / 2 ? cut.slice(0, lastSentenceEnd + 1).trim() : `${cut.slice(0, maxChars - 1).trim()}…`;
}

const LEADING_WHAT_IS = /^o que (é|e|são|sao)\s+(a|o|as|os|um|uma)?\s*/i;

/**
 * Título que cabe na lista do WhatsApp, a partir de uma pergunta ou de um título longo demais: sem
 * interrogação; se não couber, sem o "O que é a" do começo; e, por fim, cortado numa palavra inteira.
 */
export function shortTitleOf(question: string): string {
  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const withoutMarks = question.replace(/[?:.]+\s*$/g, "").trim();
  if (withoutMarks.length <= TOPIC_MENU_LIMITS.titleChars) return capitalize(withoutMarks);
  const withoutLead = withoutMarks.replace(LEADING_WHAT_IS, "").trim();
  if (withoutLead.length <= TOPIC_MENU_LIMITS.titleChars) return capitalize(withoutLead);
  const words = withoutLead.split(/\s+/);
  let title = "";
  for (const word of words) {
    if (`${title} ${word}`.trim().length > TOPIC_MENU_LIMITS.titleChars) break;
    title = `${title} ${word}`.trim();
  }
  return capitalize(title || withoutLead.slice(0, TOPIC_MENU_LIMITS.titleChars));
}

export interface TopicQuestionPick {
  /** Posição da pergunta na lista do assunto. */
  factIndex: number;
  title?: string;
}

/** Sem IA: as primeiras perguntas do assunto, na ordem do roteiro. */
export function fallbackPicks(facts: TopicFact[]): TopicQuestionPick[] {
  return facts.slice(0, TOPIC_MENU_LIMITS.maxQuestions).map((_fact, factIndex) => ({ factIndex }));
}

/**
 * As opções do menu de um assunto. A resposta é sempre o texto do roteiro; a escolha (`picks`) só diz
 * quais perguntas entram e com que título. Escolha inválida é descartada, título longo é cortado e
 * título repetido ganha um número.
 */
export function buildTopicMenuButtons(params: { tagId: string; facts: TopicFact[]; picks: TopicQuestionPick[]; canBook: boolean; canTransfer: boolean }): TopicMenuButton[] {
  const usedTitles = new Set<string>();
  const usedFacts = new Set<number>();
  const questionButtons: TopicMenuButton[] = [];
  for (const pick of params.picks) {
    const fact = params.facts[pick.factIndex];
    if (!fact || usedFacts.has(pick.factIndex) || questionButtons.length >= TOPIC_MENU_LIMITS.maxQuestions) continue;
    usedFacts.add(pick.factIndex);
    // Título da IA que passou do limite é encurtado, em vez de trocado pela pergunta inteira cortada.
    let title = shortTitleOf(pick.title?.trim() || fact.question);
    for (let suffix = 2; usedTitles.has(normalize(title)); suffix += 1) title = `${title.slice(0, TOPIC_MENU_LIMITS.titleChars - 2).trim()} ${suffix}`;
    usedTitles.add(normalize(title));
    questionButtons.push({ id: `${TOPIC_OPTION_PREFIX}${params.tagId}:${questionButtons.length + 1}`, text: title, answer: clipAtSentence(fact.answer, TOPIC_MENU_LIMITS.answerChars) });
  }
  if (questionButtons.length < TOPIC_MENU_LIMITS.minQuestions) return [];
  return [...questionButtons, ...(params.canBook ? [BOOK_OPTION] : []), ...(params.canTransfer ? [HUMAN_OPTION] : [])];
}

const TRAILING_QUESTION = /\s*[^.!?]*\?\s*$/;

/**
 * Corpo da primeira mensagem do menu: a abertura do assunto e a pergunta, numa mensagem só. A abertura
 * do roteiro costuma terminar com "Posso te explicar mais?": com as opções logo abaixo, essa pergunta
 * sobra e sai.
 */
export function topicMenuBody(opening: string): string {
  const room = TOPIC_MENU_LIMITS.bodyChars - TOPIC_MENU_ASK.length - 2;
  const withoutQuestion = opening.trim().replace(TRAILING_QUESTION, "").trim();
  return `${clipAtSentence(withoutQuestion || opening.trim(), room)}\n\n${TOPIC_MENU_ASK}`;
}

/** Corpo da mensagem depois de um clique: a resposta e o convite a escolher outra. */
export function topicAnswerBody(answer: string): string {
  const room = TOPIC_MENU_LIMITS.bodyChars - TOPIC_MENU_ASK_AGAIN.length - 2;
  return `${clipAtSentence(answer.trim(), room)}\n\n${TOPIC_MENU_ASK_AGAIN}`;
}

export function isTopicOptionId(replyId: unknown): replyId is string {
  return typeof replyId === "string" && replyId.startsWith(TOPIC_OPTION_PREFIX) && replyId.length <= 120;
}

export function isTopicMenuName(presetName: string): boolean {
  return presetName.startsWith(TOPIC_MENU_NAME_PREFIX);
}

/** A resposta da opção clicada, procurada só nos menus de perguntas recebidos (os ativos do funil). */
export function findTopicAnswer<TPreset extends { name: string; buttons: unknown }>(presets: TPreset[], replyId: unknown): { preset: TPreset; answer: string } | null {
  if (!isTopicOptionId(replyId)) return null;
  for (const preset of presets.filter((candidate) => isTopicMenuName(candidate.name))) {
    const buttons = Array.isArray(preset.buttons) ? (preset.buttons as { id?: unknown; answer?: unknown }[]) : [];
    const clicked = buttons.find((button) => button?.id === replyId);
    if (clicked && typeof clicked.answer === "string" && clicked.answer.trim()) return { preset, answer: clicked.answer };
  }
  return null;
}
