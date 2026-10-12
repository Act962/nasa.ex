import { PLACEHOLDER_MARK } from "@/features/workflows/lib/placeholder-text";
import type { ScriptDraft } from "./script-draft";

// Modelo de atendimento por menu (spec 0097): conteúdo fixo, sem IA, para a empresa ver a forma de um
// atendimento completo e trocar os textos entre colchetes pelos dela.

const fill = (instruction: string) => `${PLACEHOLDER_MARK} ${instruction}]`;

export interface TemplateTopic {
  title: string;
  topicName: string;
  introMessage: string;
  questions: { title: string; answer: string }[];
}

export const ATTENDANCE_TEMPLATE_TOPICS: TemplateTopic[] = [
  {
    title: "Conhecer os serviços",
    topicName: "Conhecer os serviços",
    introMessage: `Que bom que você quer conhecer o nosso trabalho! ${fill("uma frase sobre o que a sua empresa faz")}`,
    questions: [
      { title: "Como funciona", answer: fill("como funciona o seu serviço, do primeiro contato até a entrega") },
      { title: "Para quem é", answer: fill("para quem o seu serviço é indicado") },
      { title: "Quanto tempo leva", answer: fill("o prazo ou a duração do serviço") },
    ],
  },
  {
    title: "Preços e pagamento",
    topicName: "Preços e pagamento",
    introMessage: `Vou te passar as informações de preço e pagamento. ${fill("uma frase sobre como você apresenta os valores")}`,
    questions: [
      { title: "Valores", answer: fill("os valores, ou como o cliente pede um orçamento") },
      { title: "Formas de pagamento", answer: fill("as formas de pagamento que você aceita") },
      { title: "Parcelamento", answer: fill("se parcela, em quantas vezes e em quais condições") },
    ],
  },
  {
    title: "Horários e endereço",
    topicName: "Horários e endereço",
    introMessage: `Aqui estão as informações para você falar com a gente ou nos visitar. ${fill("uma frase de boas-vindas")}`,
    questions: [
      { title: "Horário de atendimento", answer: fill("os dias e os horários de atendimento") },
      { title: "Endereço", answer: fill("o endereço completo e um ponto de referência") },
      { title: "Como chegar", answer: fill("estacionamento, transporte ou o link do mapa") },
    ],
  },
];

/** O modelo no formato das peças do roteiro (tags, títulos do menu e desenho do fluxo), sem nada gerado por IA. */
export function attendanceTemplateMenuOptions(): ScriptDraft["menuOptions"] {
  return ATTENDANCE_TEMPLATE_TOPICS.map((topic) => ({
    title: topic.title,
    topicName: topic.topicName,
    // Sem descrição para a IA: enquanto é modelo, só o clique no menu aplica a tag.
    whenToTag: "",
    introMessage: topic.introMessage,
    bookingLink: null,
    facts: topic.questions.map((question) => ({ question: question.title, answer: question.answer })),
  }));
}

export function attendanceTemplateGreeting(companyName: string): string {
  return `Olá! Aqui é o atendimento da ${companyName}. Escolha uma opção ou escreva sua dúvida.`;
}
