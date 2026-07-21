// Registro central dos campos do card/coluna do Kanban que podem ser
// escondidos por tracking, mais o helper de leitura. Fonte de verdade
// consumida pelo Sheet de personalização, pelo card (`lead-item.tsx`) e
// pelo header da coluna (`status-header.tsx`).

export type CardFieldId =
  | "temperature"
  | "nickname"
  | "phone"
  | "tags"
  | "description"
  | "purchaseBasket"
  | "aiIndicator"
  | "dateLabel"
  | "slaTimer"
  | "conversation"
  | "forms"
  | "nextAppointment"
  | "actionsCounter"
  | "deadline"
  | "responsible"
  | "leadValue"
  | "leadCount"
  | "columnValueTotal";

// Mapa `fieldId → visível`. Chave ausente = visível (default true), então
// `{}` = tudo visível. É o formato salvo em `TrackingCardConfig.cardVisibility`.
export type CardVisibility = Partial<Record<CardFieldId, boolean>>;

export type CardFieldGroup = "card" | "column";

export type CardFieldDefinition = {
  id: CardFieldId;
  label: string;
  description?: string;
  group: CardFieldGroup;
  // `locked` só aparece para deixar explícito que é sempre visível (ex.: nome).
  locked?: boolean;
};

// Ordem aqui = ordem de exibição no Sheet.
export const CARD_FIELDS: CardFieldDefinition[] = [
  {
    id: "temperature",
    label: "Temperatura",
    description: "Bolinha colorida sobre o avatar (frio/quente).",
    group: "card",
  },
  {
    id: "nickname",
    label: "Apelido",
    description: "Pill ao lado do nome do lead.",
    group: "card",
  },
  {
    id: "phone",
    label: "Telefone",
    group: "card",
  },
  {
    id: "tags",
    label: "Tags",
    group: "card",
  },
  {
    id: "description",
    label: "Descrição",
    description: "Campo de observação editável no card.",
    group: "card",
  },
  {
    id: "purchaseBasket",
    label: "Cesta de compra",
    description: "Ícone que indica quando o lead comprou pela última vez.",
    group: "card",
  },
  {
    id: "aiIndicator",
    label: "Indicador de IA",
    description: "Selo do agente de IA no card.",
    group: "card",
  },
  {
    id: "dateLabel",
    label: "Data",
    description: "Data no rodapé (acompanha a ordenação ativa).",
    group: "card",
  },
  {
    id: "slaTimer",
    label: "Cronômetro de SLA",
    description: "Contador de prazo da etapa.",
    group: "card",
  },
  {
    id: "conversation",
    label: "Conversa (WhatsApp)",
    description: "Ícone de canal/atendimento que abre o chat.",
    group: "card",
  },
  {
    id: "forms",
    label: "Formulários",
    description: "Ícone agregado de formulários do lead.",
    group: "card",
  },
  {
    id: "nextAppointment",
    label: "Próximo agendamento",
    group: "card",
  },
  {
    id: "actionsCounter",
    label: "Ações",
    description: "Contador de ações concluídas/total. Clicar abre as ações.",
    group: "card",
  },
  {
    id: "deadline",
    label: "Prazo",
    description: "Selo de prazo mais urgente entre os formulários.",
    group: "card",
  },
  {
    id: "responsible",
    label: "Responsável",
    description: "Avatar do responsável pelo lead.",
    group: "card",
  },
  {
    id: "leadValue",
    label: "Valor do lead",
    description: "Valor monetário do lead (oculto quando R$ 0,00).",
    group: "card",
  },
  {
    id: "leadCount",
    label: "Contagem de leads",
    description: "Número de leads no título da coluna.",
    group: "column",
  },
  {
    id: "columnValueTotal",
    label: "Total de valores",
    description: "Soma dos valores dos leads da coluna.",
    group: "column",
  },
];

export function isFieldVisible(
  visibility: CardVisibility | null | undefined,
  id: CardFieldId,
): boolean {
  return visibility?.[id] !== false;
}

// Precedência única de visibilidade: o preview ao vivo do Sheet só vale para o
// tracking que está sendo editado; caso contrário usa o config salvo. Chamado
// pelo card, pelo header da coluna e pelo hook `useCardVisibility`.
export function resolveCardVisibility(
  saved: CardVisibility | null | undefined,
  preview: { trackingId: string; values: CardVisibility } | null,
  trackingId: string,
): CardVisibility | null {
  if (preview?.trackingId === trackingId) return preview.values;
  return saved ?? null;
}
