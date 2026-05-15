/**
 * Slash composer — templates de comandos.
 *
 * Cada CommandTemplate define uma sequência de steps a partir de um par
 * verbo+app. O composer cliente é um state machine que navega esses steps,
 * coleta valores e finalmente monta um prompt natural pra mandar ao Astro.
 *
 * Cores dos chips:
 *  - verb    → azul     (CRIAR, BUSCAR, EDITAR, MOVER, EXCLUIR, ENVIAR)
 *  - app     → violeta  (LEAD, AGENDAMENTO, AUTOMAÇÃO, TAG, etc.)
 *  - entity  → rosa     (lookups assíncronos via orpc.astro.searchEntities)
 *  - param   → cinza    (campos texto livre)
 *  - date    → âmbar    (data/hora — aceita "amanhã", "16/05 10h", etc.)
 *  - enum    → esmeralda (valores fixos de um conjunto pequeno)
 */

export type ChipCategory =
  | "verb"
  | "app"
  | "entity"
  | "param"
  | "date"
  | "enum";

export type EntityKind =
  | "lead"
  | "agenda"
  | "tag"
  | "status"
  | "member"
  | "tracking"
  | "workspace"
  | "appointment"
  | "proposal"
  | "form";

export interface StepDef {
  /** Identificador interno do step dentro do template. */
  key: string;
  /** Categoria visual do chip que será criado. */
  category: Exclude<ChipCategory, "verb" | "app">;
  /** Label curto pra mostrar no picker e em "campo vazio". */
  label: string;
  /** Texto explicativo no picker (ex: "Quem participa do agendamento?"). */
  prompt?: string;
  /** Required? Se false, user pode pular. */
  required: boolean;
  /** Pra category=entity. */
  entityKind?: EntityKind;
  /** Pra category=enum. */
  options?: Array<{ value: string; label: string }>;
  /** Placeholder do input free-text. */
  placeholder?: string;
}

export interface CommandTemplate {
  /** Pra match: o composer carrega o template após user picar verbo+app. */
  verb: string;
  app: string;
  /** Label da combinação verb+app (ex: "Criar lead"). */
  title: string;
  /** Ícone hint pra picker (lucide name). */
  icon?: string;
  steps: StepDef[];
  /**
   * Builder do prompt final em linguagem natural a partir dos values
   * coletados (Record<stepKey, ChipValue>). É isso que vai pro Astro chat.
   */
  buildPrompt: (values: Record<string, ChipValue>) => string;
}

export interface ChipValue {
  /** Texto exibido no chip. */
  display: string;
  /** Valor "raw" — string (text), ID (entity), ISO/freeform (date). */
  raw: string;
  /** Pra entity: ID + label preservados pra o LLM resolver melhor. */
  entityId?: string;
  entityLabel?: string;
}

// ─── Catálogo de Verbos ──────────────────────────────────────────────────────

export const VERBS = [
  { id: "criar", label: "Criar", icon: "Plus" },
  { id: "buscar", label: "Buscar", icon: "Search" },
  // futuros: editar, mover, excluir, enviar
] as const;

export type VerbId = (typeof VERBS)[number]["id"];

// ─── Apps por Verbo ──────────────────────────────────────────────────────────

export const APPS_BY_VERB: Record<VerbId, ReadonlyArray<{ id: string; label: string; icon?: string }>> = {
  criar: [
    { id: "lead", label: "Lead", icon: "User" },
    { id: "agendamento", label: "Agendamento", icon: "Calendar" },
    { id: "automacao", label: "Automação", icon: "Bell" },
    { id: "tag", label: "Tag", icon: "Tag" },
  ],
  buscar: [
    { id: "lead", label: "Lead", icon: "User" },
    { id: "proposta", label: "Proposta", icon: "FileText" },
  ],
};

// ─── Templates ───────────────────────────────────────────────────────────────

const TEMPLATES: CommandTemplate[] = [
  // ── CRIAR LEAD ───────────────────────────────────────────────────────────
  {
    verb: "criar",
    app: "lead",
    title: "Criar lead",
    icon: "User",
    steps: [
      {
        key: "nome",
        category: "param",
        label: "Nome",
        prompt: "Como esse lead se chama?",
        required: true,
        placeholder: "Ex: João Silva",
      },
      {
        key: "telefone",
        category: "param",
        label: "Telefone",
        prompt: "Telefone (opcional)",
        required: false,
        placeholder: "Ex: 11 99999-9999",
      },
      {
        key: "tracking",
        category: "entity",
        label: "Tracking",
        prompt: "Em qual tracking? (opcional)",
        required: false,
        entityKind: "tracking",
      },
    ],
    buildPrompt: (v) => {
      const parts = [`Criar lead "${v.nome?.raw ?? ""}"`];
      if (v.telefone?.raw) parts.push(`telefone ${v.telefone.raw}`);
      if (v.tracking?.entityLabel)
        parts.push(`no tracking "${v.tracking.entityLabel}"`);
      return parts.join(", ") + ".";
    },
  },

  // ── CRIAR AGENDAMENTO ────────────────────────────────────────────────────
  {
    verb: "criar",
    app: "agendamento",
    title: "Criar agendamento",
    icon: "Calendar",
    steps: [
      {
        key: "agenda",
        category: "entity",
        label: "Agenda",
        prompt: "Qual agenda?",
        required: true,
        entityKind: "agenda",
      },
      {
        key: "lead",
        category: "entity",
        label: "Lead",
        prompt: "Com qual lead?",
        required: true,
        entityKind: "lead",
      },
      {
        key: "data",
        category: "date",
        label: "Data",
        prompt: 'Quando? (Ex: "amanhã 10h", "16/05 14:30")',
        required: true,
        placeholder: "amanhã 10h",
      },
      {
        key: "titulo",
        category: "param",
        label: "Título",
        prompt: "Título do encontro (opcional)",
        required: false,
        placeholder: "Ex: Reunião de descoberta",
      },
    ],
    buildPrompt: (v) => {
      const parts = ["Agendar reunião"];
      if (v.titulo?.raw) parts.push(`"${v.titulo.raw}"`);
      if (v.agenda?.entityLabel)
        parts.push(`na agenda "${v.agenda.entityLabel}"`);
      if (v.lead?.entityLabel)
        parts.push(`com o lead "${v.lead.entityLabel}"`);
      if (v.data?.raw) parts.push(`${v.data.raw}`);
      return parts.join(" ") + ".";
    },
  },

  // ── CRIAR AUTOMAÇÃO (AlertRule via Astro) ────────────────────────────────
  {
    verb: "criar",
    app: "automacao",
    title: "Criar automação",
    icon: "Bell",
    steps: [
      {
        key: "evento",
        category: "enum",
        label: "Evento",
        prompt: "Qual evento dispara o alerta?",
        required: true,
        options: [
          { value: "lead.stale", label: "Lead sem contato há X dias" },
          {
            value: "lead.status_changed",
            label: "Lead muda pra um status",
          },
          { value: "lead.tag_added", label: "Lead recebe uma tag" },
          { value: "form.submitted", label: "Formulário preenchido" },
          {
            value: "agenda.starting_soon",
            label: "Agenda começa em N minutos",
          },
          {
            value: "forge.proposal_status_changed",
            label: "Proposta muda de status",
          },
          {
            value: "integration.whatsapp_down",
            label: "WhatsApp desconectado",
          },
        ],
      },
      {
        key: "severidade",
        category: "enum",
        label: "Severidade",
        prompt: "Qual nível de alerta?",
        required: true,
        options: [
          { value: "info", label: "Info — só sininho" },
          { value: "warning", label: "Atenção — toast persistente" },
          { value: "critical", label: "Crítico — popup interruptivo" },
        ],
      },
      {
        key: "audiencia",
        category: "enum",
        label: "Audiência",
        prompt: "Quem recebe?",
        required: true,
        options: [
          { value: "lead_responsible", label: "Responsável do lead" },
          { value: "org_supervisors", label: "Supervisores da empresa" },
          { value: "org_admins", label: "Admins da empresa" },
          {
            value: "action_participants",
            label: "Participantes da ação",
          },
          { value: "whole_org", label: "Toda a empresa" },
        ],
      },
      {
        key: "extra",
        category: "param",
        label: "Detalhes",
        prompt:
          "Detalhes extras (ex: nome da tag, quantos dias, status alvo). Opcional.",
        required: false,
        placeholder: "Ex: 2 dias, tag Quente, status Negociação",
      },
    ],
    buildPrompt: (v) => {
      const labels: Record<string, string> = {
        "lead.stale": "lead sem contato",
        "lead.status_changed": "mudança de status do lead",
        "lead.tag_added": "tag adicionada ao lead",
        "form.submitted": "formulário preenchido",
        "agenda.starting_soon": "agenda começando em breve",
        "forge.proposal_status_changed": "mudança de status de proposta",
        "integration.whatsapp_down": "WhatsApp desconectado",
      };
      const audLabels: Record<string, string> = {
        lead_responsible: "responsável do lead",
        org_supervisors: "supervisores da empresa",
        org_admins: "admins da empresa",
        action_participants: "participantes da ação",
        whole_org: "toda a empresa",
      };
      const evento = v.evento?.raw ?? "";
      const severidade = v.severidade?.raw ?? "info";
      const audiencia = v.audiencia?.raw ?? "user";
      const extra = v.extra?.raw?.trim();
      const eventoLabel = labels[evento] ?? evento;
      const audLabel = audLabels[audiencia] ?? audiencia;

      let prompt = `Criar automação: quando "${eventoLabel}", disparar alerta ${severidade} pra ${audLabel}.`;
      if (extra) prompt += ` Detalhes: ${extra}.`;
      return prompt;
    },
  },

  // ── CRIAR TAG ────────────────────────────────────────────────────────────
  {
    verb: "criar",
    app: "tag",
    title: "Criar tag",
    icon: "Tag",
    steps: [
      {
        key: "nome",
        category: "param",
        label: "Nome",
        prompt: "Nome da tag",
        required: true,
        placeholder: "Ex: Quente",
      },
    ],
    buildPrompt: (v) => `Criar tag "${v.nome?.raw ?? ""}".`,
  },

  // ── BUSCAR LEAD ──────────────────────────────────────────────────────────
  {
    verb: "buscar",
    app: "lead",
    title: "Buscar lead",
    icon: "User",
    steps: [
      {
        key: "termo",
        category: "param",
        label: "Termo",
        prompt: "Nome, email ou telefone",
        required: true,
        placeholder: "Ex: João Silva",
      },
    ],
    buildPrompt: (v) => `Buscar lead "${v.termo?.raw ?? ""}".`,
  },

  // ── BUSCAR PROPOSTA ──────────────────────────────────────────────────────
  {
    verb: "buscar",
    app: "proposta",
    title: "Buscar proposta",
    icon: "FileText",
    steps: [
      {
        key: "termo",
        category: "param",
        label: "Termo",
        prompt: "Título ou número",
        required: true,
        placeholder: "Ex: Proposta Acme",
      },
    ],
    buildPrompt: (v) => `Buscar proposta "${v.termo?.raw ?? ""}".`,
  },
];

const byKey = new Map(TEMPLATES.map((t) => [`${t.verb}:${t.app}`, t]));

export function findTemplate(
  verb: string,
  app: string,
): CommandTemplate | undefined {
  return byKey.get(`${verb}:${app}`);
}

export function listTemplates(): readonly CommandTemplate[] {
  return TEMPLATES;
}

// ─── Cores por categoria ─────────────────────────────────────────────────────

export const CHIP_STYLE: Record<
  ChipCategory,
  { bg: string; border: string; text: string }
> = {
  verb: {
    bg: "bg-blue-500/15",
    border: "border-blue-500/40",
    text: "text-blue-300",
  },
  app: {
    bg: "bg-violet-500/15",
    border: "border-violet-500/40",
    text: "text-violet-300",
  },
  entity: {
    bg: "bg-pink-500/15",
    border: "border-pink-500/40",
    text: "text-pink-300",
  },
  param: {
    bg: "bg-zinc-500/15",
    border: "border-zinc-500/40",
    text: "text-zinc-300",
  },
  date: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    text: "text-amber-300",
  },
  enum: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    text: "text-emerald-300",
  },
};
