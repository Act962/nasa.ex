// Confere o menu de perguntas por assunto (spec 0096). Puro: sem banco e sem IA.
import {
  TOPIC_MENU_LIMITS,
  buildTopicMenuButtons,
  clipAtSentence,
  fallbackPicks,
  findTopicAnswer,
  isTopicOptionId,
  parseTopicFacts,
  shortTitleOf,
  topicAnswerBody,
  topicMenuBody,
} from "../src/features/tracking-chat-ai/lib/topic-menu";

let failureCount = 0;
function check(name: string, isOk: boolean, detail = "") {
  if (!isOk) failureCount += 1;
  console.log(`${isOk ? "ok  " : "FALHA"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const knowledge = [
  "> Origem: roteiro de atendimento (x)",
  "# Clínica",
  "## Informações gerais",
  "- **Endereço** Rua A, 10.",
  "## Cirurgia de Catarata",
  "> Quando: Cliente perguntou sobre catarata.",
  "- **O que é a catarata?** É a opacificação do cristalino. Costuma aparecer com a idade.",
  "- **Como é a cirurgia?** É feita com anestesia local e dura cerca de 20 minutos.",
  "- **Qual o tempo de recuperação da cirurgia de catarata?** A maioria volta às atividades em poucos dias.",
  "- **Aceita convênio?** Sim, os convênios aceitos são informados pela equipe.",
  "## Assunto curto",
  "- **Só uma pergunta?** Só uma resposta.",
].join("\n");
const topics = parseTopicFacts(knowledge);
check("CA-1 assuntos saem do documento sem IA; Informações gerais não vira menu", topics.length === 2 && topics[0].topicName === "Cirurgia de Catarata" && topics[0].facts.length === 4);
check("CA-1 pergunta e resposta ficam separadas", topics[0].facts[1].question === "Como é a cirurgia?" && topics[0].facts[1].answer.startsWith("É feita com anestesia"));

const buttons = buildTopicMenuButtons({ tagId: "tag1", facts: topics[0].facts, picks: [{ factIndex: 2, title: "Recuperação" }, { factIndex: 0 }, { factIndex: 9 }, { factIndex: 2, title: "Repetida" }, { factIndex: 3, title: "Um título que passa muito do limite permitido" }], canBook: true, canTransfer: true });
const questions = buttons.filter((button) => button.answer);
check("CA-2 toda resposta é um trecho do documento", questions.length === 3 && questions.every((button) => knowledge.includes(button.answer!)));
check("CA-3 títulos com até 24 caracteres e sem repetição", buttons.every((button) => button.text.length <= TOPIC_MENU_LIMITS.titleChars) && new Set(buttons.map((button) => button.text)).size === buttons.length, buttons.map((button) => button.text).join(" | "));
check("escolha inválida ou repetida é descartada; título longo cai no título curto da pergunta", questions[0].text === "Recuperação" && questions[1].text === "O que é a catarata" && questions[2].text === "Um título que passa", questions.map((button) => button.text).join(" | "));
check("título que não cabe perde o \"O que é a\" e é cortado em palavra inteira, sem reticências", shortTitleOf("O que é a Cirurgia Refrativa?") === "Cirurgia Refrativa" && shortTitleOf("O que é a Toxina Botulínica?") === "Toxina Botulínica" && !shortTitleOf("Qual o tempo de recuperação da cirurgia de catarata?").includes("…"));
check("a pergunta do fim da abertura sai, porque as opções vêm logo abaixo", topicMenuBody("O SLT controla o glaucoma. Gostaria que eu te explicasse como ele funciona?") === "O SLT controla o glaucoma.\n\nO que você quer saber?" && topicMenuBody("Só uma pergunta aqui?").startsWith("Só uma pergunta aqui?"));
check("os ids dizem o assunto e a ordem", questions.map((button) => button.id).join() === "tq:tag1:1,tq:tag1:2,tq:tag1:3");
check("com o menu de botões ligado entram Agendar e Falar com atendente", buttons.slice(-2).map((button) => button.id).join() === "cli:book,cli:human");
check("CA-5 sem o menu de botões essas linhas não entram", buildTopicMenuButtons({ tagId: "t", facts: topics[0].facts, picks: fallbackPicks(topics[0].facts), canBook: false, canTransfer: false }).every((button) => button.id.startsWith("tq:")));
check("CB-1 assunto com menos de duas perguntas não ganha menu", buildTopicMenuButtons({ tagId: "t", facts: topics[1].facts, picks: fallbackPicks(topics[1].facts), canBook: true, canTransfer: true }).length === 0);
check("sem IA valem as primeiras perguntas, com título cortado", buildTopicMenuButtons({ tagId: "t", facts: topics[0].facts, picks: fallbackPicks(topics[0].facts), canBook: false, canTransfer: false }).length === 4 && shortTitleOf("Qual o tempo de recuperação da cirurgia de catarata?").length <= 24);

const longAnswer = `${"Frase completa de teste. ".repeat(60)}`;
check("CB-2 resposta longa é cortada no fim de uma frase", clipAtSentence(longAnswer, 850).length <= 850 && clipAtSentence(longAnswer, 850).endsWith("."));
check("CA-3 o corpo das duas mensagens cabe no limite da lista", topicMenuBody(longAnswer).length <= 1024 && topicAnswerBody(longAnswer).length <= 1024 && topicMenuBody("Abertura.").endsWith("O que você quer saber?"));

const presets = [
  { name: "Perguntas: Cirurgia de Catarata", buttons },
  { name: "Menu inicial do atendimento", buttons: [{ id: "tq:tag1:1", text: "Falso", answer: "resposta de outro menu" }] },
];
check("CA-4 clique numa pergunta devolve a resposta daquela opção", findTopicAnswer(presets, "tq:tag1:1")?.answer === questions[0].answer);
check("CA-4 só vale opção de um menu de perguntas", findTopicAnswer([presets[1]], "tq:tag1:1") === null);
check("CA-4 id desconhecido, de outro tipo ou gigante volta para a assistente", findTopicAnswer(presets, "tq:tag1:99") === null && findTopicAnswer(presets, "cli:book") === null && findTopicAnswer(presets, 42) === null && !isTopicOptionId(`tq:${"x".repeat(200)}`));

console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
process.exit(failureCount === 0 ? 0 : 1);
