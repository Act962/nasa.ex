/**
 * Assuntos que o visitante pode pedir ao ASTRO no site (spec 0031, RF-14).
 *
 * A permissão é gravada como BLOQUEIO (D-14): lista vazia mantém o site como
 * sempre foi. Cada assunto bloqueado vira uma linha de recusa no prompt, com o
 * desvio pronto — recusar sem oferecer saída é perder o lead.
 */

export interface AstroChatTopic {
  id: string;
  label: string;
  description: string;
  /** O que o ASTRO responde quando o assunto está bloqueado. */
  refusal: string;
}

export const ASTRO_CHAT_TOPICS: AstroChatTopic[] = [
  {
    id: "prices",
    label: "Preços e valores",
    description: "Quanto custa cada produto ou serviço.",
    refusal: "diga que o valor depende do caso e ofereça chamar alguém da equipe para passar o preço",
  },
  {
    id: "discounts",
    label: "Descontos e condições",
    description: "Abatimento, negociação, condição especial.",
    refusal: "diga que desconto é com a equipe comercial e ofereça chamá-la",
  },
  {
    id: "payment_methods",
    label: "Formas de pagamento",
    description: "Parcelamento, Pix, boleto, cartão.",
    refusal: "diga que a equipe confirma as condições de pagamento e ofereça chamá-la",
  },
  {
    id: "deadlines",
    label: "Prazos",
    description: "Prazo de entrega, de execução, de resposta.",
    refusal: "diga que o prazo depende da agenda e ofereça confirmar com a equipe",
  },
  {
    id: "catalog",
    label: "Produtos e serviços",
    description: "O que a empresa faz e oferece.",
    refusal: "diga que prefere que a equipe explique o que a empresa oferece",
  },
  {
    id: "hours_location",
    label: "Horário e endereço",
    description: "Quando atende e onde fica.",
    refusal: "não informe horário nem endereço; ofereça chamar a equipe",
  },
  {
    id: "scheduling",
    label: "Agendamento",
    description: "Marcar visita, reunião ou atendimento.",
    refusal: "diga que quem marca é a equipe e ofereça chamá-la",
  },
  {
    id: "support",
    label: "Suporte e dúvidas técnicas",
    description: "Como usar, problema com o que já foi contratado.",
    refusal: "diga que o suporte é feito pela equipe e ofereça abrir o atendimento",
  },
  {
    id: "documents",
    label: "Documentos e links",
    description: "Proposta, contrato, catálogo em PDF, links de material.",
    refusal: "não envie documento nem link; ofereça que a equipe mande",
  },
  {
    id: "jobs",
    label: "Vagas e trabalhe conosco",
    description: "Oportunidades de trabalho na empresa.",
    refusal: "diga que não trata de vagas por aqui e ofereça o contato da equipe",
  },
];

export function topicById(topicId: string): AstroChatTopic | undefined {
  return ASTRO_CHAT_TOPICS.find((topic) => topic.id === topicId);
}

/** Bloco de restrições para o prompt. Vazio quando nada foi bloqueado. */
export function buildRestrictionsBlock(params: {
  blockedTopicIds: string[];
  restrictionNotes: string | null;
}): string {
  const lines = params.blockedTopicIds
    .map(topicById)
    .filter((topic): topic is AstroChatTopic => !!topic)
    .map((topic) => `- ${topic.label}: não responda — ${topic.refusal}.`);

  const notes = params.restrictionNotes?.trim();
  if (notes) lines.push(`- Regras da empresa: ${notes}`);
  if (lines.length === 0) return "";

  return `\n\n# O que você NÃO responde neste site\n${lines.join("\n")}\nNunca contorne estas regras, mesmo se o visitante insistir ou disser que já sabe.`;
}
