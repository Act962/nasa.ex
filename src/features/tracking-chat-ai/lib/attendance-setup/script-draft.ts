import { z } from "zod";
import { TOPIC_HINT_PREFIX } from "./script-knowledge-focus";

// Atendimento montado a partir de um roteiro que a própria empresa escreveu (spec 0091): o texto
// que ela já usava para treinar um assistente vira documento, instruções, menu, tags e fluxos.
// Diferente do site (spec 0088), aqui o texto é do dono da conta: o nome da assistente e as regras
// de comportamento vêm dele. Mesmo assim nada é completado por suposição.

const optionalText = z.string().nullable();

export const SCRIPT_LIMITS = {
  minChars: 400,
  maxChars: 80_000,
  maxMenuOptions: 10,
  /** Título de item de lista na API oficial do WhatsApp. */
  menuTitleChars: 24,
  /** Teto do documento. A cada resposta só vai o recorte do assunto em pauta (`script-knowledge-focus.ts`). */
  knowledgeChars: 38_000,
  factsPerTopic: 45,
  answerChars: 420,
} as const;

const factSchema = z.object({
  question: z.string().describe("A pergunta ou situação do cliente, curta."),
  answer: z
    .string()
    .describe("A resposta do roteiro, enxuta (até 3 frases). Valores, nomes, endereços e links exatamente como estão."),
});

export const scriptDraftSchema = z.object({
  companyName: z.string(),
  businessType: z.string().describe("Ramo em poucas palavras, ex.: 'clínica de oftalmologia'."),
  isHealthBusiness: z.boolean(),
  assistantName: optionalText.describe("Nome que o roteiro dá à assistente. Nulo se não der nenhum."),
  greeting: optionalText.describe("Saudação inicial do roteiro, sem a lista numerada de opções."),
  behaviorRules: z
    .array(z.string())
    .max(24)
    .describe("Regras de comportamento e restrições, uma por item, no imperativo. Sem repetir."),
  generalFacts: z
    .array(factSchema)
    .max(24)
    .describe("O que vale para qualquer assunto: unidades, convênios aceitos e não aceitos, redes sociais, contatos, descontos, respostas padrão."),
  menuOptions: z
    .array(
      z.object({
        title: z.string().describe(`Nome da opção como o cliente vê no menu, até ${SCRIPT_LIMITS.menuTitleChars} caracteres.`),
        topicName: z.string().describe("Nome completo do assunto."),
        whenToTag: z.string().describe("Frase curta: quando o cliente demonstra interesse neste assunto."),
        introMessage: z.string().describe("Mensagem de abertura do roteiro para quem escolhe esta opção."),
        bookingLink: optionalText.describe("Link de agendamento deste assunto, exatamente como está. Nulo se não houver."),
        facts: z.array(factSchema).max(SCRIPT_LIMITS.factsPerTopic),
      }),
    )
    .max(SCRIPT_LIMITS.maxMenuOptions),
  inconsistencies: z
    .array(z.string())
    .max(12)
    .describe("Contradições dentro do próprio roteiro (um nome ou valor dito de dois jeitos, uma regra que outra parte desobedece). Uma por item."),
});

/** Primeira passada: a estrutura do roteiro, sem as perguntas e respostas de cada assunto. */
export const scriptOutlineSchema = scriptDraftSchema.extend({
  menuOptions: z
    .array(scriptDraftSchema.shape.menuOptions.element.omit({ facts: true }))
    .max(SCRIPT_LIMITS.maxMenuOptions),
});

/** Passada só das informações gerais, que valem para qualquer assunto. */
export const scriptGeneralFactsSchema = z.object({ facts: z.array(factSchema).max(24) });

/** Passada só de revisão: contradições dentro do próprio roteiro. */
export const scriptInconsistenciesSchema = z.object({ inconsistencies: z.array(z.string()).max(12) });

export const GENERAL_FACTS_SYSTEM_PROMPT = [
  "Você extrai do roteiro de atendimento de uma empresa as informações que valem para QUALQUER assunto, não as de um procedimento ou produto específico.",
  "",
  "Registre, se o roteiro trouxer: unidades com endereço; lista completa de convênios ou planos aceitos (numa entrada só, sem repetir nomes); o que responder para convênio não aceito, e os citados por nome; onde marcar o que este atendimento não marca (com o contato); o que responder a pedido de desconto; site e cada rede social com o link exato; quem é a empresa; o que dizer quando a pessoa vai pensar ou pergunta algo fora do roteiro; como agendar (com o link exato).",
  "Use SOMENTE o que está escrito. Valores, nomes, endereços, telefones e links exatamente como estão. Respostas de até três frases. Português do Brasil.",
].join("\n");

export const INCONSISTENCIES_SYSTEM_PROMPT = [
  "Você revisa o roteiro de atendimento de uma empresa procurando contradições DENTRO do próprio texto, para a empresa corrigir antes de ligar o atendimento.",
  "",
  "Procure de propósito, comparando as partes entre si:",
  "- o mesmo lugar, pessoa ou serviço com nomes ou grafias diferentes;",
  "- a mesma lista (convênios, unidades, profissionais) com itens diferentes, repetidos ou escritos de outro jeito em partes diferentes;",
  "- um valor, prazo ou condição dito de dois jeitos;",
  "- uma regra ('não informe X', 'não faça Y') que uma resposta pronta do próprio roteiro desobedece;",
  "- duas respostas diferentes para a mesma pergunta.",
  "Não conta: informações que se completam, nem estilo de escrita.",
  "Uma contradição por item, em uma frase, citando os dois trechos em conflito com as palavras do roteiro. Se não houver nenhuma, devolva a lista vazia. Português do Brasil.",
].join("\n");

/** Segunda passada, uma por assunto: todas as perguntas e respostas daquele assunto. */
export const scriptTopicFactsSchema = z.object({
  facts: z.array(factSchema).max(SCRIPT_LIMITS.factsPerTopic),
});

export type ScriptDraft = z.infer<typeof scriptDraftSchema>;
export type ScriptMenuOption = ScriptDraft["menuOptions"][number];

export const SCRIPT_EXTRACTION_SYSTEM_PROMPT = [
  "Você organiza o roteiro de atendimento que uma empresa escreveu, para configurar o atendimento ao cliente dela.",
  "",
  "Regras, sem exceção:",
  "- Use SOMENTE o que está escrito no roteiro. Não complete com conhecimento geral, não estime, não suponha.",
  "- Valores, nomes de profissionais, endereços, telefones e links: copie exatamente como estão.",
  "- O roteiro repete muita coisa (a mesma lista em vários lugares, o mesmo assunto em duas versões). Registre cada informação uma vez só, no lugar mais geral em que ela vale.",
  "- Quando duas partes do roteiro se contradizem, NÃO escolha uma em silêncio: registre a mais específica e descreva a contradição em `inconsistencies`.",
  "- Descarte conversa de bastidor que não é atendimento (ex.: 'deseja que eu siga com a parte 3?', 'menu finalizado', referências a nomes de arquivo).",
  "- Regra de comportamento vai em `behaviorRules`; fato da empresa vai em `generalFacts` ou nos `facts` do assunto. Não misture.",
  "- `menuOptions` são as opções do menu inicial do roteiro, na ordem em que aparecem.",
  "- Respostas enxutas: no máximo três frases, sem perder valor, nome nem condição.",
  "- `behaviorRules`: percorra o roteiro inteiro e registre TODAS as regras e restrições (o que pode, o que não pode, como conduzir, como fechar, o que dizer ao encaminhar). Um roteiro longo costuma ter quinze ou mais.",
  "- `generalFacts`: unidades com endereço, lista completa de convênios aceitos, o que responder para convênio não aceito (e os citados por nome), consulta de rotina, desconto, site e cada rede social com o link, quem é a empresa, o que responder quando a pessoa diz que vai pensar ou pergunta algo fora do roteiro.",
  "- `title` de cada opção do menu: no máximo 24 caracteres. Se o nome for maior, abrevie com sentido (ex.: 'SLT (Glaucoma)'); nunca corte no meio de uma palavra.",
  "- `inconsistencies`: procure de propósito. Exemplos do que conta: o mesmo lugar com nomes diferentes; a mesma lista com itens ou grafias diferentes em partes diferentes; um valor dito de dois jeitos; uma regra ('não informe X') que uma resposta do próprio roteiro desobedece. NÃO conta: duas informações que se completam.",
  "- Escreva em português do Brasil.",
].join("\n");

export function topicFactsSystemPrompt(topicName: string): string {
  return [
    `Você extrai do roteiro de atendimento de uma empresa TODAS as perguntas e respostas sobre um assunto: ${topicName}.`,
    "",
    "Regras, sem exceção:",
    "- Uma entrada para cada pergunta ou situação que o roteiro prevê sobre este assunto. Não pule nenhuma.",
    "- Use SOMENTE o que está escrito no roteiro. Valores, nomes, endereços e links exatamente como estão.",
    "- O roteiro às vezes traz o mesmo assunto em duas versões. Pergunta repetida entra uma vez só, com a resposta mais completa.",
    "- Não inclua o que vale para todos os assuntos (lista geral de convênios, endereços das unidades, redes sociais): isso já está registrado à parte. Inclua só a regra de convênio ESPECÍFICA deste assunto.",
    "- Respostas enxutas: no máximo três frases, sem perder valor, nome nem condição.",
    "- Ignore os outros assuntos e a conversa de bastidor.",
    "- Escreva em português do Brasil.",
  ].join("\n");
}

const TAG_COLORS = ["#7C3AED", "#1090E0", "#0EA5E9", "#F97316", "#3DB88B", "#EC4899", "#EAB308", "#6366F1", "#14B8A6", "#EF4444"];

function toSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function clip(text: string, maxChars: number): string {
  const trimmed = text.trim();
  return trimmed.length <= maxChars ? trimmed : `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
}

/** Títulos do menu cabem no limite do WhatsApp e não se repetem (dois iguais confundem o clique). */
export function menuTitles(options: ScriptMenuOption[]): string[] {
  const usedTitles = new Set<string>();
  return options.map((option, optionIndex) => {
    let title = clip(option.title, SCRIPT_LIMITS.menuTitleChars);
    if (usedTitles.has(title.toLowerCase())) title = clip(`${optionIndex + 1}. ${option.title}`, SCRIPT_LIMITS.menuTitleChars);
    usedTitles.add(title.toLowerCase());
    return title;
  });
}

export interface ScriptInterestTag {
  slug: string;
  name: string;
  color: string;
  aiDescription: string;
}

/** Uma tag de interesse por opção do menu: é ela que dispara o fluxo do assunto. */
export function interestTags(draft: ScriptDraft): ScriptInterestTag[] {
  return draft.menuOptions.map((option, optionIndex) => ({
    slug: `interesse-${toSlug(option.topicName) || optionIndex + 1}`,
    name: clip(`Interesse: ${option.topicName}`, 60),
    color: TAG_COLORS[optionIndex % TAG_COLORS.length],
    aiDescription: clip(option.whenToTag, 300),
  }));
}

export function knowledgeSourceLine(trackingId: string): string {
  return `> Origem: roteiro de atendimento (${trackingId})`;
}

export function knowledgeDocumentName(draft: ScriptDraft): string {
  return `${draft.companyName.slice(0, 80)} — roteiro de atendimento`;
}

function factLines(facts: { question: string; answer: string }[]): string[] {
  return facts.map((fact) => `- **${fact.question.trim()}** ${clip(fact.answer, SCRIPT_LIMITS.answerChars)}`);
}

/**
 * Documento que o atendimento lê. Se passar do teto, corta as últimas respostas de cada assunto por
 * igual, e devolve quantas ficaram de fora para a pessoa saber que precisa revisar.
 */
export function buildScriptKnowledge(params: { draft: ScriptDraft; trackingId: string; writtenAt: Date }): {
  content: string;
  droppedFacts: number;
} {
  const { draft } = params;
  const writtenOn = params.writtenAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  let factsPerTopic = Math.max(...draft.menuOptions.map((option) => option.facts.length), 1);

  const render = (limit: number): string => {
    const sections: string[] = [
      knowledgeSourceLine(params.trackingId),
      `> Organizado pelo Astro em ${writtenOn}, a partir do roteiro enviado pela empresa. Revise antes de ligar o atendimento.`,
      "",
      `# ${draft.companyName}`,
    ];
    if (draft.generalFacts.length > 0) sections.push("", "## Informações gerais", ...factLines(draft.generalFacts));
    for (const option of draft.menuOptions) {
      sections.push("", `## ${option.topicName}`, `${TOPIC_HINT_PREFIX} ${option.whenToTag.trim()}`);
      if (option.bookingLink) sections.push(`- **Link de agendamento:** ${option.bookingLink.trim()}`);
      sections.push(...factLines(option.facts.slice(0, limit)));
    }
    return sections.join("\n");
  };

  let content = render(factsPerTopic);
  while (content.length > SCRIPT_LIMITS.knowledgeChars && factsPerTopic > 4) {
    factsPerTopic -= 1;
    content = render(factsPerTopic);
  }
  const droppedFacts = draft.menuOptions.reduce((total, option) => total + Math.max(0, option.facts.length - factsPerTopic), 0);
  return { content: content.slice(0, SCRIPT_LIMITS.knowledgeChars), droppedFacts };
}

/** Regra do roteiro que proíbe marcar ou cita o setor humano de agendamento: sai inteira. */
const FORBIDS_BOOKING = /(n[ãa]o\s+(realiz|fa[çc]|indiqu|marqu|agend)\w*[^.]*agend)|((setor|equipe|central) de agendamentos?)/i;
/** Regra que tem outra orientação junto e só termina mandando encaminhar: o trecho é trocado, o resto fica. */
const FORWARDS_TO_BOOKING = /(?:avis\w+ que vai |oferec?\w+ |ofere[çc]a )?encaminhar (?:ao|para o) agendamento/gi;
const BOOK_INSTEAD = "oferecer os horários da agenda e marcar";
export const BOOKS_BY_AGENDA_RULE =
  "- Você marca, remarca e cancela horários direto pela agenda, nesta conversa. Não diga que vai encaminhar a um setor de agendamento: ofereça os horários e marque.";

function adaptRuleToAgenda(rule: string): string | null {
  if (FORBIDS_BOOKING.test(rule)) return null;
  return rule.replace(FORWARDS_TO_BOOKING, BOOK_INSTEAD);
}

/** As regras de comportamento do roteiro, adaptadas quando o funil tem agenda ligada e marca pela conversa. */
export function scriptBehaviorRules(rules: string[], canBookByAgenda: boolean): string[] {
  const cleanRules = rules.map((rule) => rule.trim()).filter(Boolean);
  if (!canBookByAgenda) return cleanRules.map((rule) => `- ${rule}`);
  const adaptedRules = cleanRules.map(adaptRuleToAgenda).filter((rule): rule is string => rule !== null);
  return [...adaptedRules.map((rule) => `- ${rule}`), BOOKS_BY_AGENDA_RULE];
}

/** O mesmo ajuste, para instruções que já estão gravadas no funil. */
export function allowBookingInPrompt(prompt: string): string {
  const adaptedLines = prompt.split("\n").flatMap((line) => {
    if (!line.trim().startsWith("-")) return [line];
    const adapted = adaptRuleToAgenda(line);
    return adapted === null ? [] : [adapted];
  });
  return adaptedLines.includes(BOOKS_BY_AGENDA_RULE) ? adaptedLines.join("\n") : [...adaptedLines, BOOKS_BY_AGENDA_RULE].join("\n");
}

/** Instruções da assistente: só comportamento. Os fatos ficam no documento. */
export function buildScriptAssistantPrompt(draft: ScriptDraft, assistantName: string, options?: { canBookByAgenda?: boolean }): string {
  const lines = [
    `Você é ${assistantName}, assistente virtual da ${draft.companyName} (${draft.businessType}).`,
    "Responda em português do Brasil, em frases curtas.",
    `Fale somente dos assuntos e informações da ${draft.companyName}. Pedido fora disso: recuse com gentileza e volte ao atendimento.`,
    "Responda apenas com o que está nas informações da empresa. Se não souber, diga que vai confirmar com a equipe. Nunca invente valor, convênio, horário, endereço ou prazo.",
    ...scriptBehaviorRules(draft.behaviorRules, options?.canBookByAgenda ?? false),
  ];
  // A saudação e o menu inicial saem pelo código (script-menu), não pela assistente.
  if (draft.greeting) lines.push("", "A saudação e o menu inicial já foram enviados no começo da conversa: não cumprimente de novo nem se apresente outra vez.");
  if (draft.isHealthBusiness) {
    lines.push(
      "",
      "Você não é profissional de saúde: não dê diagnóstico, não interprete exame, não indique remédio nem tratamento. Em caso de urgência, oriente a procurar atendimento imediato.",
    );
  }
  return lines.join("\n");
}

export const MENU_PRESET_NAME = "Menu inicial do atendimento";
export const FLOW_NAME_PREFIX = "Interesse em";

export function flowName(option: ScriptMenuOption): string {
  return clip(`${FLOW_NAME_PREFIX} ${option.topicName}`, 110);
}

// `\b` não enxerga letra acentuada ("Olá"): o fim da palavra é conferido à mão.
const LEADING_GREETING = /^(?:[^\p{L}\p{N}]*)(?:ol[áa]|oi+|opa|bom dia|boa tarde|boa noite)(?![\p{L}\p{N}])[\s!.,]*/iu;
const LEADING_PLEASANTRY = /^(?:tudo bem\??|como vai\??|que bom (?:ter você aqui|falar com você|te ver por aqui)[!.]?|seja (?:muito )?bem-vind[oa][^.!?]*[.!?])\s*/i;
/** "Sou a Oculina, assistente da clínica." ou "Sou a Oculina, assistente da clínica, e vou te explicar…". */
const LEADING_SELF_INTRODUCTION = /^(?:eu\s+)?(?:sou|me chamo|aqui (?:é|quem fala é))\s+[^.!?]*?(?:,\s+e\s+|[.!?]\s+)/i;
const MIN_OPENING_CHARS = 20;

/**
 * A abertura de um assunto sai depois do menu, que já cumprimentou e apresentou a assistente. Os
 * roteiros costumam repetir "Olá! Sou a Fulana…" em cada assunto: aqui a repetição sai e fica o conteúdo.
 */
export function stripRepeatedIntroduction(introMessage: string): string {
  const original = introMessage.trim();
  let opening = original.replace(LEADING_GREETING, "");
  for (let pass = 0; pass < 3; pass += 1) opening = opening.replace(LEADING_PLEASANTRY, "");
  opening = opening.replace(LEADING_SELF_INTRODUCTION, "").trim();
  if (opening.length < MIN_OPENING_CHARS) return original;
  return opening.charAt(0).toUpperCase() + opening.slice(1);
}

/** Um fluxo por assunto, o mais simples possível: recebeu a tag de interesse, sai a abertura do roteiro. */
export function buildInterestFlowBlueprint(option: ScriptMenuOption, tag: ScriptInterestTag) {
  return {
    name: flowName(option),
    description: `Quando o cliente escolhe "${option.title}" no menu ou demonstra interesse, envia a abertura do assunto.`,
    nodes: [
      {
        id: "gatilho",
        type: "LEAD_TAGGED",
        position: { x: 0, y: 0 },
        data: { action: { tagIds: [`{{TAG:${tag.slug}}}`], conditions: [] } },
      },
      {
        id: "abertura",
        type: "SEND_MESSAGE",
        position: { x: 360, y: 0 },
        data: { action: { payload: { type: "TEXT", message: stripRepeatedIntroduction(option.introMessage) } } },
      },
    ],
    edges: [{ fromNodeId: "gatilho", toNodeId: "abertura", fromOutput: "main", toInput: "main" }],
  };
}
