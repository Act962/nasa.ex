// Cards-modelo do Gatilho do lead (spec 0038, RF-3). Puro: usado na tela e no servidor.

export type LeadTriggerTemplateKey = "FOLLOW_UP" | "SCHEDULED_RETURN" | "PAYMENT_REMINDER" | "POST_SALE";

export interface LeadTriggerTemplate {
  key: LeadTriggerTemplateKey;
  title: string;
  description: string;
  defaultMessage: string;
  /** Atalho sugerido quando o card é ligado pela primeira vez. */
  defaultOffsetDays: number;
}

export const LEAD_NAME_PLACEHOLDER = "{nome}";

export const LEAD_TRIGGER_TEMPLATES: LeadTriggerTemplate[] = [
  {
    key: "FOLLOW_UP",
    title: "Follow-up",
    description: "Retoma a conversa com quem parou de responder.",
    defaultMessage: "Oi, {nome}! Passando para saber se ficou alguma dúvida. Posso te ajudar em algo?",
    defaultOffsetDays: 2,
  },
  {
    key: "SCHEDULED_RETURN",
    title: "Retorno combinado",
    description: "Volta a falar no dia que vocês combinaram.",
    defaultMessage: "Oi, {nome}! Como combinamos, estou retornando. Podemos seguir?",
    defaultOffsetDays: 7,
  },
  {
    key: "PAYMENT_REMINDER",
    title: "Lembrete de pagamento",
    description: "Avisa do vencimento com antecedência.",
    defaultMessage: "Oi, {nome}! Lembrando que o pagamento vence em breve. Qualquer dúvida, é só chamar.",
    defaultOffsetDays: 3,
  },
  {
    key: "POST_SALE",
    title: "Pós-venda",
    description: "Pergunta como foi a experiência depois da compra.",
    defaultMessage: "Oi, {nome}! Como está sendo a experiência? Sua opinião é muito importante para nós.",
    defaultOffsetDays: 15,
  },
];

/** "A cada X dias" entre repetições (RF-3). */
export const LEAD_TRIGGER_INTERVAL_OPTIONS: { label: string; days: number }[] = [
  { label: "A cada 1 dia", days: 1 },
  { label: "A cada 2 dias", days: 2 },
  { label: "A cada 3 dias", days: 3 },
  { label: "A cada 5 dias", days: 5 },
  { label: "A cada 1 semana", days: 7 },
  { label: "A cada 15 dias", days: 15 },
  { label: "A cada 1 mês", days: 30 },
];

/** Quantas vezes o gatilho dispara no ciclo (1x, 2x, 3x…). */
export const LEAD_TRIGGER_REPETITION_OPTIONS = [1, 2, 3, 4, 5, 7, 10];

/** Variáveis da mensagem, abertas digitando "/" (RF-4). */
export const LEAD_TRIGGER_VARIABLES: { token: string; label: string }[] = [
  { token: "{nome}", label: "Primeiro nome" },
  { token: "{nome_completo}", label: "Nome completo" },
  { token: "{telefone}", label: "Telefone" },
  { token: "{email}", label: "E-mail" },
  { token: "{responsavel}", label: "Responsável" },
];

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function hasLeadNamePlaceholder(message: string): boolean {
  return message.includes(LEAD_NAME_PLACEHOLDER);
}

export interface TriggerMessageLead {
  name: string;
  phone?: string | null;
  email?: string | null;
  responsibleName?: string | null;
}

/** Troca as variáveis pelos dados do lead; `{nome}` é o primeiro nome (RF-4). */
export function renderTriggerMessage(message: string, lead: TriggerMessageLead): string {
  const firstName = lead.name.trim().split(/\s+/)[0] || lead.name;
  const values: Record<string, string> = {
    "{nome}": firstName,
    "{nome_completo}": lead.name,
    "{telefone}": lead.phone ?? "",
    "{email}": lead.email ?? "",
    "{responsavel}": lead.responsibleName ?? "",
  };
  return Object.entries(values).reduce((text, [token, value]) => text.split(token).join(value), message);
}
