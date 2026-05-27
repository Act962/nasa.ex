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
  | "form"
  | "workflow_folder";

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
  /**
   * Pra category=entity: permite criar uma nova entidade inline. Quando
   * o usuário digita um nome e não acha nada, mostra "+ Criar <nome>".
   * O ChipValue resultante tem `raw = "__create__:<nome>"` — o handler
   * downstream (CmdkPalette ou onSubmit) precisa criar a entidade antes
   * de usar o ID. Atualmente só usado pra `workflow_folder`.
   */
  creatable?: boolean;
}

export interface CommandTemplate {
  /** Pra match: o composer carrega o template após user picar verbo+app. */
  verb: string;
  app: string;
  /** Label da combinação verb+app (ex: "Criar lead"). */
  title: string;
  /** Ícone hint pra picker (lucide name). */
  icon?: string;
  /** Categoria visual no picker de apps. Default mostra todos juntos. */
  group?: "trigger" | "execution" | "send-to-app";
  steps: StepDef[];
  /**
   * Builder do prompt final em linguagem natural a partir dos values
   * coletados (Record<stepKey, ChipValue>). É isso que vai pro Astro chat.
   */
  buildPrompt: (values: Record<string, ChipValue>) => string;
  /**
   * Quando presente, o composer NÃO manda pro Astro — chama esse intent
   * direto. Útil pra ações que têm API própria (ex: criar Workflow).
   */
  directIntent?: {
    /** Tipo do intent — handler decide o que fazer. */
    type: "create_workflow";
    /** Payload extra fixo (ex: nodeType). */
    payload?: Record<string, string>;
  };
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
  { id: "editar", label: "Editar", icon: "Pencil" },
  { id: "mover", label: "Mover", icon: "MoveRight" },
  { id: "enviar", label: "Enviar", icon: "Send" },
  { id: "automatizar", label: "Automatizar", icon: "Workflow" },
  // EXCLUIR removido por política de segurança: deleção só via app manual.
  // O Astro recusa pedidos de delete com a mensagem padrão (ver
  // PERSONA_CORE em src/features/astro/lib/prompts).
] as const;

export type VerbId = (typeof VERBS)[number]["id"];

// ─── Apps por Verbo ──────────────────────────────────────────────────────────

export const APPS_BY_VERB: Record<VerbId, ReadonlyArray<{ id: string; label: string; icon?: string; group?: string }>> = {
  criar: [
    { id: "lead", label: "Lead", icon: "User" },
    { id: "evento", label: "Evento", icon: "CalendarClock" },
    { id: "agendamento", label: "Agendamento", icon: "Calendar" },
    { id: "despesa", label: "Despesa", icon: "TrendingDown" },
    { id: "receita", label: "Receita", icon: "TrendingUp" },
    { id: "automacao", label: "Alerta", icon: "Bell" },
    { id: "tag", label: "Tag", icon: "Tag" },
  ],
  buscar: [
    { id: "lead", label: "Lead", icon: "User" },
    { id: "evento", label: "Evento", icon: "CalendarClock" },
    { id: "despesa", label: "Despesa", icon: "TrendingDown" },
    { id: "receita", label: "Receita", icon: "TrendingUp" },
    { id: "proposta", label: "Proposta", icon: "FileText" },
  ],
  editar: [{ id: "lead", label: "Lead", icon: "User" }],
  mover: [{ id: "lead", label: "Lead", icon: "User" }],
  enviar: [{ id: "whatsapp", label: "WhatsApp", icon: "MessageCircle" }],
  // Automatizar — todos os tipos de Node (trigger + execution + send-to-app).
  // Quando user pica um, cria Workflow direto pelo Cmd+K (sem passar pelo
  // Astro chat) e navega pro editor com o node escolhido prefilled.
  automatizar: [
    // ── Gatilhos ───────────────────────────────────────────
    { id: "trigger.MANUAL_TRIGGER", label: "Gatilho: Manual", icon: "MousePointer", group: "trigger" },
    { id: "trigger.NEW_LEAD", label: "Gatilho: Novo Lead", icon: "UserPlus", group: "trigger" },
    { id: "trigger.MOVE_LEAD_STATUS", label: "Gatilho: Mover Lead pra Status", icon: "MoveHorizontal", group: "trigger" },
    { id: "trigger.LEAD_TAGGED", label: "Gatilho: Lead com Tag", icon: "Tags", group: "trigger" },
    { id: "trigger.AI_FINISHED", label: "Gatilho: IA Finalizou Atendimento", icon: "Bot", group: "trigger" },
    { id: "trigger.FIRST_CHAT_INTERACTION", label: "Gatilho: Primeira Interação", icon: "MessageSquare", group: "trigger" },
    // ── Ações ──────────────────────────────────────────────
    { id: "action.MOVE_LEAD", label: "Ação: Mover Lead", icon: "ArrowLeftRight", group: "execution" },
    { id: "action.SEND_MESSAGE", label: "Ação: Enviar Mensagem", icon: "Send", group: "execution" },
    { id: "action.WAIT", label: "Ação: Esperar", icon: "Timer", group: "execution" },
    { id: "action.WIN_LOSS", label: "Ação: Ganho/Perdido", icon: "Trophy", group: "execution" },
    { id: "action.TAG", label: "Ação: Adicionar Tag", icon: "Tag", group: "execution" },
    { id: "action.TEMPERATURE", label: "Ação: Temperatura", icon: "CircleGauge", group: "execution" },
    { id: "action.RESPONSIBLE", label: "Ação: Responsável", icon: "UserRoundPlus", group: "execution" },
    { id: "action.FILTER_LEAD", label: "Ação: Filtrar Leads", icon: "Funnel", group: "execution" },
    // ── Adicionar Lead no App ──────────────────────────────
    { id: "app.SEND_FORM", label: "App: Enviar Formulário", icon: "ClipboardList", group: "send-to-app" },
    { id: "app.SEND_AGENDA", label: "App: Enviar Agenda", icon: "Calendar", group: "send-to-app" },
    { id: "app.SEND_PROPOSAL", label: "App: Enviar Proposta", icon: "FileSignature", group: "send-to-app" },
    { id: "app.SEND_CONTRACT", label: "App: Enviar Contrato", icon: "FileText", group: "send-to-app" },
    { id: "app.SEND_LINNKER", label: "App: Enviar Linnker", icon: "Link2", group: "send-to-app" },
    { id: "app.SEND_NBOX", label: "App: Enviar Arquivo N-Box", icon: "FolderOpen", group: "send-to-app" },
    { id: "app.SEND_NASA_ROUTE", label: "App: Enviar Curso NASA Route", icon: "GraduationCap", group: "send-to-app" },
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

  // ── CRIAR EVENTO (workspace Action) ──────────────────────────────────────
  {
    verb: "criar",
    app: "evento",
    title: "Criar evento",
    icon: "CalendarClock",
    steps: [
      {
        key: "titulo",
        category: "param",
        label: "Título",
        prompt: "Qual o título do evento?",
        required: true,
        placeholder: "Ex: Revisar campanha",
      },
      {
        key: "data",
        category: "date",
        label: "Data",
        prompt: 'Quando? (Ex: "hoje", "amanhã 10h", "16/05 14:30")',
        required: false,
        placeholder: "hoje",
      },
    ],
    buildPrompt: (v) => {
      const parts = [`Criar evento "${v.titulo?.raw ?? ""}"`];
      if (v.data?.raw) parts.push(`pra ${v.data.raw}`);
      return parts.join(" ") + ".";
    },
  },

  // ── CRIAR DESPESA (PaymentEntry PAYABLE) ─────────────────────────────────
  {
    verb: "criar",
    app: "despesa",
    title: "Criar despesa",
    icon: "TrendingDown",
    steps: [
      {
        key: "valor",
        category: "param",
        label: "Valor",
        prompt: "Quanto? (Ex: 100, R$ 1.250,50)",
        required: true,
        placeholder: "100",
      },
      {
        key: "descricao",
        category: "param",
        label: "Descrição",
        prompt: "Sobre o que? (ex: 'abastecimento no Posto Coruja')",
        required: true,
        placeholder: "Ex: Abastecimento",
      },
    ],
    buildPrompt: (v) =>
      `Insira ${v.valor?.raw ?? ""} reais de ${v.descricao?.raw ?? ""}.`,
  },

  // ── CRIAR RECEITA (PaymentEntry RECEIVABLE) ──────────────────────────────
  {
    verb: "criar",
    app: "receita",
    title: "Criar receita",
    icon: "TrendingUp",
    steps: [
      {
        key: "valor",
        category: "param",
        label: "Valor",
        prompt: "Quanto? (Ex: 500, R$ 1.250,50)",
        required: true,
        placeholder: "500",
      },
      {
        key: "descricao",
        category: "param",
        label: "Descrição",
        prompt: "De que recebimento?",
        required: true,
        placeholder: "Ex: Pagamento de serviço",
      },
      {
        key: "cliente",
        category: "param",
        label: "Cliente",
        prompt: "De quem? (opcional)",
        required: false,
        placeholder: "Ex: João Silva",
      },
    ],
    buildPrompt: (v) => {
      const parts = [
        `Recebi ${v.valor?.raw ?? ""} reais de ${v.descricao?.raw ?? ""}`,
      ];
      if (v.cliente?.raw) parts.push(`do ${v.cliente.raw}`);
      return parts.join(" ") + ".";
    },
  },

  // ── BUSCAR EVENTO ────────────────────────────────────────────────────────
  {
    verb: "buscar",
    app: "evento",
    title: "Buscar evento",
    icon: "CalendarClock",
    steps: [
      {
        key: "termo",
        category: "param",
        label: "Termo",
        prompt: "Título ou descrição (opcional — vazio = lista todos)",
        required: false,
        placeholder: "Ex: Revisar campanha",
      },
    ],
    buildPrompt: (v) =>
      v.termo?.raw
        ? `Lista de eventos: "${v.termo.raw}".`
        : "Lista de eventos.",
  },

  // ── BUSCAR DESPESA ───────────────────────────────────────────────────────
  {
    verb: "buscar",
    app: "despesa",
    title: "Buscar despesa",
    icon: "TrendingDown",
    steps: [
      {
        key: "filtro",
        category: "param",
        label: "Filtro",
        prompt:
          "Filtro (opcional): período, valor, status — ex: 'desse mês acima de R$ 500 pendentes'",
        required: false,
        placeholder: "Ex: pendentes acima de 500",
      },
    ],
    buildPrompt: (v) =>
      v.filtro?.raw
        ? `Lista de despesas ${v.filtro.raw}.`
        : "Lista de despesas.",
  },

  // ── BUSCAR RECEITA ───────────────────────────────────────────────────────
  {
    verb: "buscar",
    app: "receita",
    title: "Buscar receita",
    icon: "TrendingUp",
    steps: [
      {
        key: "filtro",
        category: "param",
        label: "Filtro",
        prompt:
          "Filtro (opcional): período, valor, status, categoria, cliente",
        required: false,
        placeholder: "Ex: recebidas desse mês",
      },
    ],
    buildPrompt: (v) =>
      v.filtro?.raw
        ? `Lista de receitas ${v.filtro.raw}.`
        : "Lista de receitas.",
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

  // ── EDITAR LEAD ──────────────────────────────────────────────────────────
  {
    verb: "editar",
    app: "lead",
    title: "Editar lead",
    icon: "Pencil",
    steps: [
      {
        key: "lead",
        category: "entity",
        label: "Lead",
        prompt: "Qual lead?",
        required: true,
        entityKind: "lead",
      },
      {
        key: "campo",
        category: "enum",
        label: "Campo",
        prompt: "O que quer atualizar?",
        required: true,
        options: [
          { value: "name", label: "Nome" },
          { value: "phone", label: "Telefone" },
          { value: "email", label: "Email" },
          { value: "document", label: "CPF/CNPJ" },
          { value: "description", label: "Descrição" },
        ],
      },
      {
        key: "valor",
        category: "param",
        label: "Novo valor",
        prompt: "Novo valor",
        required: true,
        placeholder: "Ex: 11 99999-9999",
      },
    ],
    buildPrompt: (v) =>
      `Atualizar lead "${v.lead?.entityLabel ?? ""}": ${
        v.campo?.display ?? ""
      } = "${v.valor?.raw ?? ""}".`,
  },

  // ── MOVER LEAD ───────────────────────────────────────────────────────────
  {
    verb: "mover",
    app: "lead",
    title: "Mover lead",
    icon: "MoveRight",
    steps: [
      {
        key: "lead",
        category: "entity",
        label: "Lead",
        prompt: "Qual lead?",
        required: true,
        entityKind: "lead",
      },
      {
        key: "status",
        category: "entity",
        label: "Status",
        prompt: "Pra qual status (do mesmo tracking)?",
        required: true,
        entityKind: "status",
      },
    ],
    buildPrompt: (v) =>
      `Mover lead "${v.lead?.entityLabel ?? ""}" pro status "${
        v.status?.entityLabel ?? ""
      }".`,
  },

  // ── ENVIAR WHATSAPP ──────────────────────────────────────────────────────
  {
    verb: "enviar",
    app: "whatsapp",
    title: "Enviar WhatsApp",
    icon: "MessageCircle",
    steps: [
      {
        key: "lead",
        category: "entity",
        label: "Lead",
        prompt: "Pra qual lead?",
        required: true,
        entityKind: "lead",
      },
      {
        key: "mensagem",
        category: "param",
        label: "Mensagem",
        prompt: "O que vai mandar?",
        required: true,
        placeholder: "Ex: Olá! Tudo bem? Quando podemos conversar?",
      },
    ],
    buildPrompt: (v) =>
      `Enviar WhatsApp pro lead "${v.lead?.entityLabel ?? ""}" com texto: "${
        v.mensagem?.raw ?? ""
      }".`,
  },

];

// ─── Templates AUTOMATIZAR (criação direta de Workflow) ──────────────────────
//
// Cada app de "automatizar" mapeia pra um NodeType. Steps comuns: tracking
// (required, onde o workflow vive), nome (required, default = label do node),
// pasta (optional, autocomplete + opção "criar nova"). Submit chama o intent
// `create_workflow` no CmdkPalette que cria o Workflow + nó inicial e navega
// pro editor — depois o usuário edita o nó pra preencher campos específicos.

interface AutomatizarSpec {
  appId: string;
  nodeType: string;
  title: string;
  icon: string;
}

const AUTOMATIZAR_SPECS: AutomatizarSpec[] = [
  // Gatilhos
  { appId: "trigger.MANUAL_TRIGGER", nodeType: "MANUAL_TRIGGER", title: "Automação: Gatilho Manual", icon: "MousePointer" },
  { appId: "trigger.NEW_LEAD", nodeType: "NEW_LEAD", title: "Automação: Novo Lead", icon: "UserPlus" },
  { appId: "trigger.MOVE_LEAD_STATUS", nodeType: "MOVE_LEAD_STATUS", title: "Automação: Mover Lead pra Status", icon: "MoveHorizontal" },
  { appId: "trigger.LEAD_TAGGED", nodeType: "LEAD_TAGGED", title: "Automação: Lead com Tag", icon: "Tags" },
  { appId: "trigger.AI_FINISHED", nodeType: "AI_FINISHED", title: "Automação: IA Finalizou", icon: "Bot" },
  { appId: "trigger.FIRST_CHAT_INTERACTION", nodeType: "FIRST_CHAT_INTERACTION", title: "Automação: Primeira Interação", icon: "MessageSquare" },
  // Ações
  { appId: "action.MOVE_LEAD", nodeType: "MOVE_LEAD", title: "Automação: Mover Lead", icon: "ArrowLeftRight" },
  { appId: "action.SEND_MESSAGE", nodeType: "SEND_MESSAGE", title: "Automação: Enviar Mensagem", icon: "Send" },
  { appId: "action.WAIT", nodeType: "WAIT", title: "Automação: Esperar", icon: "Timer" },
  { appId: "action.WIN_LOSS", nodeType: "WIN_LOSS", title: "Automação: Ganho/Perdido", icon: "Trophy" },
  { appId: "action.TAG", nodeType: "TAG", title: "Automação: Adicionar Tag", icon: "Tag" },
  { appId: "action.TEMPERATURE", nodeType: "TEMPERATURE", title: "Automação: Temperatura", icon: "CircleGauge" },
  { appId: "action.RESPONSIBLE", nodeType: "RESPONSIBLE", title: "Automação: Responsável", icon: "UserRoundPlus" },
  { appId: "action.FILTER_LEAD", nodeType: "FILTER_LEAD", title: "Automação: Filtrar Leads", icon: "Funnel" },
  // Adicionar Lead no App
  { appId: "app.SEND_FORM", nodeType: "SEND_FORM", title: "Automação: Enviar Formulário", icon: "ClipboardList" },
  { appId: "app.SEND_AGENDA", nodeType: "SEND_AGENDA", title: "Automação: Enviar Agenda", icon: "Calendar" },
  { appId: "app.SEND_PROPOSAL", nodeType: "SEND_PROPOSAL", title: "Automação: Enviar Proposta", icon: "FileSignature" },
  { appId: "app.SEND_CONTRACT", nodeType: "SEND_CONTRACT", title: "Automação: Enviar Contrato", icon: "FileText" },
  { appId: "app.SEND_LINNKER", nodeType: "SEND_LINNKER", title: "Automação: Enviar Linnker", icon: "Link2" },
  { appId: "app.SEND_NBOX", nodeType: "SEND_NBOX", title: "Automação: Enviar Arquivo N-Box", icon: "FolderOpen" },
  { appId: "app.SEND_NASA_ROUTE", nodeType: "SEND_NASA_ROUTE", title: "Automação: Enviar Curso NASA Route", icon: "GraduationCap" },
];

for (const spec of AUTOMATIZAR_SPECS) {
  TEMPLATES.push({
    verb: "automatizar",
    app: spec.appId,
    title: spec.title,
    icon: spec.icon,
    steps: [
      {
        key: "tracking",
        category: "entity",
        label: "Tracking",
        prompt: "Em qual tracking essa automação vai existir?",
        required: true,
        entityKind: "tracking",
      },
      {
        key: "nome",
        category: "param",
        label: "Nome",
        prompt: "Nome da automação",
        required: true,
        placeholder: "Ex: Onboarding novo lead",
      },
      {
        key: "pasta",
        category: "entity",
        label: "Pasta",
        prompt:
          "Em qual pasta? (opcional — digite o nome pra criar nova, ou pule pra ficar em \"Sem pasta\")",
        required: false,
        entityKind: "workflow_folder",
        creatable: true,
      },
    ],
    // buildPrompt não é usado quando directIntent está presente, mas
    // mantemos fallback decente caso seja chamado em algum lugar.
    buildPrompt: (v) => {
      const parts = [
        `Criar automação "${v.nome?.raw ?? ""}" do tipo ${spec.nodeType}`,
      ];
      if (v.tracking?.entityLabel)
        parts.push(`no tracking "${v.tracking.entityLabel}"`);
      if (v.pasta?.entityLabel)
        parts.push(`na pasta "${v.pasta.entityLabel}"`);
      return parts.join(", ") + ".";
    },
    directIntent: {
      type: "create_workflow",
      payload: { nodeType: spec.nodeType },
    },
  });
}

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
