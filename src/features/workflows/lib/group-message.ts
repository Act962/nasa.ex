// Passo "Enviar para grupo" (spec 0101): variação do quadro Enviar Mensagem que manda um texto para
// um grupo de WhatsApp, pelo número do funil escolhido. Sem `server-only`: o editor usa as mesmas regras.

export const GROUP_MESSAGE_TYPE = "GROUP_TEXT";
export const GROUP_JID_SUFFIX = "@g.us";
export const GROUP_MESSAGE_MAX_CHARS = 3000;

export interface GroupMessagePayload {
  type: typeof GROUP_MESSAGE_TYPE;
  /** Funil cujo número envia. Fluxo agendado roda sem lead, então o funil fica gravado no passo. */
  trackingId: string;
  groupJid: string;
  groupName: string;
  message: string;
}

export const DEFAULT_GROUP_MESSAGE_PAYLOAD: GroupMessagePayload = {
  type: GROUP_MESSAGE_TYPE,
  trackingId: "",
  groupJid: "",
  groupName: "",
  message: "",
};

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" ? (value as Fields) : {};
}

/** O `payload` do quadro quando ele é um envio para grupo; `null` nos demais. */
export function groupMessagePayloadOf(data: unknown): Fields | null {
  const fields = asFields(data);
  const action = asFields(fields.action);
  const payload = asFields(Object.keys(action).length > 0 ? action.payload : fields.payload);
  return String(payload.type ?? "").toUpperCase() === GROUP_MESSAGE_TYPE ? payload : null;
}

export function isGroupJid(value: unknown): value is string {
  return typeof value === "string" && value.endsWith(GROUP_JID_SUFFIX) && value.length > GROUP_JID_SUFFIX.length;
}

/** Variáveis do resumo do dia aceitas no texto. A chave é o que vai entre chaves: `{{resumo.leads_ontem}}`. */
export const DAILY_SUMMARY_VARIABLES = [
  { key: "resumo.data", label: "Data de hoje" },
  { key: "resumo.leads_ontem", label: "Leads novos de ontem" },
  { key: "resumo.leads_semana", label: "Leads novos na semana" },
  { key: "resumo.agendamentos_hoje", label: "Agendamentos de hoje" },
  { key: "resumo.conversas_sem_resposta", label: "Conversas esperando resposta" },
  { key: "resumo.demandas_hoje", label: "Demandas que vencem hoje" },
  { key: "resumo.demandas_atrasadas", label: "Demandas atrasadas" },
] as const;

export const DAILY_SUMMARY_PREFIX = "{{resumo.";

export const DEFAULT_DAILY_SUMMARY_MESSAGE = [
  "*Resumo do dia — {{resumo.data}}*",
  "",
  "• Leads novos ontem: {{resumo.leads_ontem}} (na semana: {{resumo.leads_semana}})",
  "• Agendamentos hoje: {{resumo.agendamentos_hoje}}",
  "• Conversas esperando resposta: {{resumo.conversas_sem_resposta}}",
  "• Demandas para hoje: {{resumo.demandas_hoje}}",
  "• Demandas atrasadas: {{resumo.demandas_atrasadas}}",
].join("\n");
