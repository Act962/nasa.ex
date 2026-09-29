import {
  BellRingIcon,
  BrainIcon,
  CalendarClockIcon,
  CreditCardIcon,
  DatabaseIcon,
  FileSignatureIcon,
  FileTextIcon,
  GlobeIcon,
  HandIcon,
  HourglassIcon,
  ImageIcon,
  MailIcon,
  MessageSquareIcon,
  MicIcon,
  MoveHorizontalIcon,
  RouteIcon,
  SparklesIcon,
  SunriseIcon,
  TagIcon,
  TagsIcon,
  TimerIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";

// Catálogo do construtor rápido (spec 0039, RF-1). Só nós que o motor em modo
// agente executa — os demais da paleta clássica falhariam ao rodar ali.

export type QuickCategory = "trigger" | "actions" | "apps" | "logic" | "data" | "ai";

export interface QuickCatalogItem {
  type: string;
  label: string;
  category: QuickCategory;
  icon: LucideIcon;
  defaultData: Record<string, unknown>;
}

export const QUICK_CATEGORY_LABELS: Record<Exclude<QuickCategory, "trigger">, string> = {
  actions: "Ações",
  apps: "Apps ÓRBITA & Comunicação",
  logic: "Lógica",
  data: "Dados & Sub-Workflows",
  ai: "IA",
};

export const QUICK_CATALOG: QuickCatalogItem[] = [
  // Quando
  { type: "SCHEDULE_TRIGGER", label: "Agendado", category: "trigger", icon: CalendarClockIcon, defaultData: { schedule: { frequency: "DAILY", time: "09:00" } } },
  { type: "NEW_LEAD", label: "Novo lead", category: "trigger", icon: UserPlusIcon, defaultData: {} },
  { type: "LEAD_TAGGED", label: "Lead recebe tag", category: "trigger", icon: TagsIcon, defaultData: { action: { tagIds: [], conditions: [] } } },
  { type: "MOVE_LEAD_STATUS", label: "Lead muda de etapa", category: "trigger", icon: MoveHorizontalIcon, defaultData: { action: { statusId: "" } } },
  { type: "MESSAGE_INCOMING", label: "Lead manda mensagem", category: "trigger", icon: MessageSquareIcon, defaultData: {} },
  { type: "FIRST_CHAT_INTERACTION", label: "Primeira interação no chat", category: "trigger", icon: MessageSquareIcon, defaultData: {} },
  { type: "FIRST_INTERACTION_OF_DAY", label: "Primeira interação do dia", category: "trigger", icon: SunriseIcon, defaultData: {} },
  { type: "AI_FINISHED", label: "IA finalizou o atendimento", category: "trigger", icon: SparklesIcon, defaultData: { conditions: [] } },
  { type: "PAYMENT_RECEIVED", label: "Pagamento recebido", category: "trigger", icon: CreditCardIcon, defaultData: {} },
  { type: "MANUAL_TRIGGER", label: "Manual", category: "trigger", icon: HandIcon, defaultData: {} },
  // Ações
  { type: "SEND_MESSAGE", label: "Enviar mensagem", category: "actions", icon: MessageSquareIcon, defaultData: { action: { payload: { type: "TEXT", message: "Oi, {{lead.name}}!" } } } },
  { type: "TAG", label: "Adicionar ou remover tag", category: "actions", icon: TagIcon, defaultData: { action: { type: "ADD", tagsIds: [] } } },
  { type: "MOVE_LEAD", label: "Mover lead de etapa", category: "actions", icon: MoveHorizontalIcon, defaultData: { action: { statusId: "" } } },
  { type: "WAIT", label: "Esperar", category: "actions", icon: TimerIcon, defaultData: { action: { type: "days", days: 1 } } },
  // Apps ÓRBITA & Comunicação
  { type: "NOTIFY_TEAM", label: "Lembrar a equipe", category: "apps", icon: BellRingIcon, defaultData: { target: "USER", message: "Retornar para {{lead.name}}" } },
  { type: "SEND_EMAIL", label: "Enviar e-mail", category: "apps", icon: MailIcon, defaultData: { action: { template: "custom", toEmail: "{{lead.email}}", subject: "", html: "" } } },
  { type: "SEND_PROPOSAL", label: "Enviar proposta", category: "apps", icon: FileTextIcon, defaultData: { action: { productIds: [], validityDays: 7 }, needsReview: true, reviewReason: "Escolha os produtos da proposta." } },
  { type: "SEND_CONTRACT", label: "Enviar contrato", category: "apps", icon: FileSignatureIcon, defaultData: { action: {}, needsReview: true, reviewReason: "Escolha o modelo de contrato." } },
  { type: "SEND_VOICE", label: "Enviar voz (ASTRO)", category: "apps", icon: MicIcon, defaultData: { text: "Oi, {{lead.name}}!", voice: "shimmer" } },
  { type: "SEND_MEDIA", label: "Enviar mídia", category: "apps", icon: ImageIcon, defaultData: { mediaType: "IMAGE", url: "", caption: "", needsReview: true, reviewReason: "Informe a URL da mídia." } },
  // Lógica
  { type: "WAIT_FOR_EVENT", label: "Esperar resposta", category: "logic", icon: HourglassIcon, defaultData: { eventNames: ["message-incoming"], timeoutMinutes: 1440 } },
  // Dados & Sub-Workflows
  { type: "SET_VARIABLE", label: "Definir variável", category: "data", icon: DatabaseIcon, defaultData: { name: "", value: "" } },
  { type: "CALL_WORKFLOW", label: "Chamar sub-workflow", category: "data", icon: RouteIcon, defaultData: { workflowId: "", needsReview: true, reviewReason: "Escolha o sub-workflow." } },
  // IA
  { type: "AI_GENERATE_TEXT", label: "Gerar texto com IA", category: "ai", icon: BrainIcon, defaultData: { prompt: "", maxTokens: 200, organizationId: "<<auto>>" } },
  { type: "WEB_SEARCH", label: "Pesquisar na web", category: "ai", icon: GlobeIcon, defaultData: { query: "" } },
];

export function findCatalogItem(type: string): QuickCatalogItem | undefined {
  return QUICK_CATALOG.find((item) => item.type === type);
}
