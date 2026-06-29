/**
 * Especificações de UI dos parâmetros de cada evento do catálogo.
 *
 * Em vez do user editar JSON cru, o RuleEditDialog renderiza inputs
 * tipados a partir desses specs. Cada FieldSpec descreve UM input:
 *   - kind: tipo de UI (number, select-tracking-status, select-tag, etc).
 *   - paramKey: chave no objeto `params` da AlertRule.
 *   - label/hint: texto exibido.
 *   - required: bloqueia submit se vazio.
 *
 * Pra cada eventType do catálogo, definimos uma lista ordenada de fields.
 * Eventos com `paramsSchema: z.object({})` (sem params) caem no array vazio.
 */

export type FieldKind =
  | "number" // input number simples
  | "text" // input texto livre
  | "select-tracking-status" // cascata: tracking → status
  | "select-tag" // tag da org (filtra por tracking se selecionado)
  | "select-tracking" // qualquer tracking
  | "select-form" // form da org
  | "select-workspace" // workspace da org
  | "select-agenda" // agenda da org
  | "select-enum"; // enum estático (options inline)

export interface FieldSpec {
  paramKey: string;
  kind: FieldKind;
  label: string;
  hint?: string;
  required: boolean;
  /** Pra `number` — limites + unidade visual ("min", "dias", etc). */
  min?: number;
  max?: number;
  defaultValue?: number | string;
  unitLabel?: string;
  /** Pra `select-enum` — opções estáticas. */
  options?: { value: string; label: string }[];
}

/**
 * Mapa eventKey → list de FieldSpec.
 *
 * Eventos sem params (broadcast.manual, agenda.reminder_fired, etc) ficam
 * com array vazio — o ParamForm mostra "Esse evento não tem parâmetros".
 */
export const PARAM_FIELDS: Record<string, FieldSpec[]> = {
  "lead.status_changed": [
    {
      paramKey: "statusId",
      kind: "select-tracking-status",
      label: "Status alvo",
      hint: "O alerta dispara quando o lead entra nesse status.",
      required: true,
    },
  ],

  "lead.tag_added": [
    {
      paramKey: "tagId",
      kind: "select-tag",
      label: "Tag",
      hint: "O alerta dispara quando o lead recebe essa tag.",
      required: true,
    },
  ],

  "lead.stale": [
    {
      paramKey: "days",
      kind: "number",
      label: "Dias sem contato",
      hint: "Lead ativo cujo último contato foi há mais que X dias.",
      required: true,
      min: 1,
      max: 60,
      defaultValue: 2,
      unitLabel: "dias",
    },
  ],

  "form.submitted": [
    {
      paramKey: "formId",
      kind: "select-form",
      label: "Formulário (opcional)",
      hint: "Filtra um form específico. Deixe vazio pra disparar em qualquer um.",
      required: false,
    },
  ],

  "form.abandoned": [
    {
      paramKey: "minutes",
      kind: "number",
      label: "Tempo abandonado",
      hint: "Submissão iniciada há mais que X minutos sem completar.",
      required: true,
      min: 5,
      max: 1440,
      defaultValue: 30,
      unitLabel: "minutos",
    },
  ],

  "chat.message_received": [
    {
      paramKey: "workspaceId",
      kind: "select-workspace",
      label: "Workspace (opcional)",
      hint: "Filtra um workspace específico.",
      required: false,
    },
  ],

  "forge.proposal_status_changed": [
    {
      paramKey: "toStatus",
      kind: "select-enum",
      label: "Status alvo (opcional)",
      hint: "Filtra a transição. Vazio = qualquer mudança.",
      required: false,
      options: [
        { value: "RASCUNHO", label: "Rascunho" },
        { value: "ENVIADA", label: "Enviada" },
        { value: "VISUALIZADA", label: "Visualizada" },
        { value: "ACEITA", label: "Aceita" },
        { value: "PAGA", label: "Paga" },
        { value: "EXPIRADA", label: "Expirada" },
        { value: "CANCELADA", label: "Cancelada" },
      ],
    },
  ],

  "agenda.starting_soon": [
    {
      paramKey: "minutesBefore",
      kind: "number",
      label: "Antecedência",
      hint: "Quantos minutos ANTES do compromisso disparar o alerta.",
      required: true,
      min: 1,
      max: 1440,
      defaultValue: 15,
      unitLabel: "minutos",
    },
  ],

  "agenda.reminder_fired": [],

  "integration.whatsapp_down": [],

  "integration.meta_token_expired": [],

  "metric.below_threshold": [
    {
      paramKey: "metric",
      kind: "select-enum",
      label: "Métrica",
      required: true,
      options: [
        { value: "conversion_rate", label: "Taxa de conversão (%)" },
        { value: "ttfr_seconds", label: "Tempo médio 1ª resposta (s)" },
        { value: "stars_balance", label: "Saldo de Stars" },
        { value: "no_show_rate", label: "Taxa de no-show (%)" },
      ],
    },
    {
      paramKey: "threshold",
      kind: "number",
      label: "Threshold",
      hint: "Dispara quando a métrica fica ABAIXO desse valor.",
      required: true,
      min: 0,
      defaultValue: 5,
    },
    {
      paramKey: "windowDays",
      kind: "number",
      label: "Janela",
      hint: "Quantos dias considerar pra calcular a média.",
      required: false,
      min: 1,
      max: 90,
      defaultValue: 7,
      unitLabel: "dias",
    },
  ],

  "action.overdue": [
    {
      // Convenção `min*` no engine: filtra payload.daysOverdue >= valor.
      paramKey: "minDaysOverdue",
      kind: "number",
      label: "Dias em atraso (opcional)",
      hint: "Dispara só quando a ação está atrasada há pelo menos X dias.",
      required: false,
      min: 1,
      max: 60,
      defaultValue: 1,
      unitLabel: "dias",
    },
  ],

  "action.due_soon": [
    {
      paramKey: "hoursBefore",
      kind: "number",
      label: "Antecedência",
      hint: "Quantas horas ANTES do vencimento disparar o alerta.",
      required: true,
      min: 1,
      max: 168,
      defaultValue: 1,
      unitLabel: "horas",
    },
  ],

  "broadcast.manual": [],
};

export function getParamFields(eventKey: string): FieldSpec[] {
  return PARAM_FIELDS[eventKey] ?? [];
}
