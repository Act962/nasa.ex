// Empresa nova nasce com funis e tags de exemplo (spec 0042). Só dados: quem cria é seed-new-organization.

export const DEFAULT_TRACKING_DESCRIPTION =
  "Esse CRM foi criado como exemplo, você pode alterar seu nome, assim como as colunas";

export type DefaultTrackingTemplate = {
  name: string;
  statuses: { name: string; color: string }[];
  /** Nasce com as etapas padrão do pedido do catálogo (colunas com chave + tags de etapa, spec 0044). */
  hasCatalogStages?: boolean;
};

export const DEFAULT_TRACKINGS: DefaultTrackingTemplate[] = [
  {
    name: "Atendimento",
    statuses: [
      { name: "Novo", color: "#3b82f6" },
      { name: "Em atendimento", color: "#f59e0b" },
      { name: "Aguardando cliente", color: "#a855f7" },
      { name: "Finalizado", color: "#10b981" },
    ],
  },
  {
    name: "Vendas",
    statuses: [
      { name: "Novo lead", color: "#3b82f6" },
      { name: "Qualificação", color: "#06b6d4" },
      { name: "Proposta", color: "#f59e0b" },
      { name: "Negociação", color: "#a855f7" },
      { name: "Fechado", color: "#10b981" },
    ],
  },
  { name: "Entrega e Separação", statuses: [], hasCatalogStages: true },
  {
    name: "Financeiro",
    statuses: [
      { name: "A cobrar", color: "#ef4444" },
      { name: "Aguardando pagamento", color: "#f59e0b" },
      { name: "Pago", color: "#10b981" },
    ],
  },
  {
    name: "Jurídico",
    statuses: [
      { name: "Análise", color: "#3b82f6" },
      { name: "Em andamento", color: "#f59e0b" },
      { name: "Concluído", color: "#10b981" },
    ],
  },
];

export const DEFAULT_WIN_LOSS_REASONS = [
  { name: "Atendimento", type: "WIN" as const },
  { name: "Produto flexível", type: "WIN" as const },
  { name: "Preço acessível", type: "WIN" as const },
  { name: "Atendimento ruim", type: "LOSS" as const },
  { name: "Produto não atendeu", type: "LOSS" as const },
  { name: "Não atendeu", type: "LOSS" as const },
];

/** Slugs fixos: as regras de tag automática acham a tag da empresa por eles. */
export const AUTO_TAG_SLUGS = {
  catalog: "catalogo",
  inService: "em-atendimento",
  awaitingReply: "aguard-atendimento",
  whatsapp: "whatsapp",
  instagram: "instagram",
  facebook: "facebook",
  siteChat: "chat-do-site",
  newLead: "novo-lead",
  paidTraffic: "trafego",
} as const;

export type AutoTagKey = keyof typeof AUTO_TAG_SLUGS;

export const DEFAULT_TAGS: { key: AutoTagKey; name: string; color: string; description: string }[] = [
  { key: "catalog", name: "Catálogo", color: "#10b981", description: "Comprou pelo catálogo online." },
  { key: "inService", name: "Em atendimento", color: "#3b82f6", description: "Cliente mandou mensagem." },
  { key: "awaitingReply", name: "Aguard. atendimento", color: "#f59e0b", description: "Cliente esperando resposta." },
  { key: "whatsapp", name: "WhatsApp", color: "#22c55e", description: "Chegou pelo WhatsApp." },
  { key: "instagram", name: "Instagram", color: "#e1306c", description: "Chegou pelo Instagram." },
  { key: "facebook", name: "Facebook", color: "#1877f2", description: "Chegou pelo Facebook." },
  { key: "siteChat", name: "Chat do site", color: "#8b5cf6", description: "Chegou pelo chat do site." },
  { key: "newLead", name: "Novo lead", color: "#06b6d4", description: "Primeiro contato do cliente." },
  { key: "paidTraffic", name: "Tráfego", color: "#f97316", description: "Chegou por anúncio." },
];
