// ─── NASA Command Center — Variáveis e Apps Centralizados ────────────────────
// Esse arquivo é a fonte única de verdade para todas as /variáveis e #Apps
// disponíveis no Command Center e em qualquer novo App / Ferramenta de integração.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VariableItem {
  label: string;
  value: string;
  description?: string;
}

export interface VariableCategory {
  emoji: string;
  label: string;
  items: VariableItem[];
}

export interface AppItem {
  id: string;
  label: string;
  color: string;
  url: string;
  group: "nasa" | "integration";
}

// ─── /Variáveis ──────────────────────────────────────────────────────────────

export const variableCategories: VariableCategory[] = [
  // ── Datas & Tempo ─────────────────────────────────────────────────────────
  {
    emoji: "📅",
    label: "Datas & Tempo",
    items: [
      { label: "/hoje",           value: "/hoje",           description: "Data de hoje" },
      { label: "/amanhã",         value: "/amanhã",         description: "Data de amanhã" },
      { label: "/semana_que_vem", value: "/semana_que_vem", description: "Próxima semana" },
      { label: "/DD",             value: "/DD",             description: "Dia (01–31)" },
      { label: "/MM",             value: "/MM",             description: "Mês (01–12)" },
      { label: "/YYYY",           value: "/YYYY",           description: "Ano completo (ex: 2026)" },
      { label: "/DD.MM.AAAA",     value: "/DD.MM.AAAA",     description: "Data formatada" },
      { label: "/hh:mm:ss",       value: "/hh:mm:ss",       description: "Hora, minuto e segundo" },
      { label: "/tempo_duracao",  value: "/tempo_duracao",  description: "Duração de tempo" },
    ],
  },

  // ── Empresa & CRM ─────────────────────────────────────────────────────────
  {
    emoji: "🏢",
    label: "Empresa & CRM",
    items: [
      { label: "/Empresa",        value: "/Empresa",        description: "Nome da empresa" },
      { label: "/Contato",        value: "/Contato",        description: "Contato principal" },
      { label: "/E-mail",         value: "/E-mail",         description: "Endereço de e-mail" },
      { label: "/Responsável",    value: "/Responsável",    description: "Responsável pelo lead" },
      { label: "/Temperatura",    value: "/Temperatura",    description: "Temperatura do lead (Quente/Frio)" },
      { label: "/tag",            value: "/tag",            description: "Tag para classificação" },
    ],
  },

  // ── Leads ─────────────────────────────────────────────────────────────────
  {
    emoji: "🎯",
    label: "Leads",
    items: [
      { label: "/lead",           value: "/lead",           description: "Lead específico" },
      { label: "/novo_lead",      value: "/novo_lead",      description: "Criar novo lead" },
      { label: "/mover_lead",     value: "/mover_lead",     description: "Mover lead de etapa" },
      { label: "/Ganho",          value: "/Ganho",          description: "Lead marcado como ganho" },
      { label: "/Perdido",        value: "/Perdido",        description: "Lead marcado como perdido" },
      { label: "/Francisco_Lima", value: "/Francisco_Lima", description: "Contato exemplo" },
      { label: "/João_Silva",     value: "/João_Silva",     description: "Contato exemplo" },
      { label: "/Maria_Costa",    value: "/Maria_Costa",    description: "Contato exemplo" },
    ],
  },

  // ── Tracking & Pipeline ───────────────────────────────────────────────────
  {
    emoji: "📊",
    label: "Tracking & Pipeline",
    items: [
      { label: "/tracking",       value: "/tracking",       description: "Pipeline / Funil" },
      { label: "/status_tracking",value: "/status_tracking",description: "Status atual no pipeline" },
      { label: "/Add_tracking",   value: "/Add_tracking",   description: "Adicionar novo tracking" },
    ],
  },

  // ── Pesquisa Universal ────────────────────────────────────────────────────
  {
    emoji: "🔍",
    label: "Pesquisa",
    items: [
      {
        label: "/pesquisar",
        value: "/pesquisar",
        description: "Busca empresas, leads, trackings, e-mails, responsáveis, automações e usuários",
      },
    ],
  },

  // ── Automações ────────────────────────────────────────────────────────────
  {
    emoji: "⚡",
    label: "Automações",
    items: [
      { label: "/Automacao",        value: "/Automacao",        description: "Fluxo de automação" },
      { label: "/Add_automacao",    value: "/Add_automacao",    description: "Criar nova automação" },
      { label: "/gatilho_manual",   value: "/gatilho_manual",   description: "Disparar gatilho manualmente" },
      { label: "/IA_finalizou",     value: "/IA_finalizou",     description: "Evento: IA concluiu tarefa" },
      { label: "/Enviar_mensagem",  value: "/Enviar_mensagem",  description: "Ação: enviar mensagem" },
      { label: "/Esperar",          value: "/Esperar",          description: "Ação: aguardar intervalo" },
      { label: "/Assistente_chatbot", value: "/Assistente_chatbot", description: "Chatbot / assistente IA" },
    ],
  },

  // ── Produtos & Ofertas ────────────────────────────────────────────────────
  {
    emoji: "📦",
    label: "Produtos & Ofertas",
    items: [
      { label: "/PRODUTX",      value: "/PRODUTX",      description: "Produto genérico" },
      { label: "/Plano_Pro",    value: "/Plano_Pro",    description: "Plano Pro" },
      { label: "/Consultoria",  value: "/Consultoria",  description: "Serviço de consultoria" },
    ],
  },

  // ── Equipe ────────────────────────────────────────────────────────────────
  {
    emoji: "👥",
    label: "Equipe",
    items: [
      { label: "/Astro",   value: "/Astro",   description: "Usuário Astro" },
      { label: "/Weydson", value: "/Weydson", description: "Usuário Weydson" },
    ],
  },

  // ── Links Gerados ─────────────────────────────────────────────────────────
  {
    emoji: "🔗",
    label: "Links Gerados",
    items: [
      { label: "/link_proposta_criada",     value: "/link_proposta_criada",     description: "Link da proposta gerada" },
      { label: "/link_contrato_criado",     value: "/link_contrato_criado",     description: "Link do contrato gerado" },
      { label: "/link_agendamento_criado",  value: "/link_agendamento_criado",  description: "Link do agendamento gerado" },
      { label: "/link_post_criado",         value: "/link_post_criado",         description: "Link do post gerado" },
    ],
  },
];

// ─── #Apps NASA ──────────────────────────────────────────────────────────────

export const nasaApps: AppItem[] = [
  { id: "nasachat",     label: "#nasachat",     color: "text-violet-400",  url: "/tracking-chat", group: "nasa" },
  { id: "forge",        label: "#forge",        color: "text-orange-400",  url: "/forge",         group: "nasa" },
  { id: "agenda",       label: "#agenda",       color: "text-blue-400",    url: "/agendas",       group: "nasa" },
  { id: "nasa-post",    label: "#nasa-post",    color: "text-pink-400",    url: "/nasa-post",     group: "nasa" },
  { id: "tracking",     label: "#tracking",     color: "text-green-400",   url: "/tracking",      group: "nasa" },
  { id: "nbox",         label: "#nbox",         color: "text-purple-400",  url: "/nbox",          group: "nasa" },
  { id: "contatos",     label: "#contatos",     color: "text-yellow-400",  url: "/contatos",      group: "nasa" },
  { id: "linnker",      label: "#linnker",      color: "text-cyan-400",    url: "/integrations",  group: "nasa" },
  { id: "apps",         label: "#apps",         color: "text-rose-400",    url: "/apps",          group: "nasa" },
];

// ─── #Apps Integrações ────────────────────────────────────────────────────────

export const integrationApps: AppItem[] = [
  { id: "whatsapp",          label: "#whatsapp",          color: "text-emerald-400",  url: "/integrations?slug=whatsapp-business",  group: "integration" },
  { id: "instagram",         label: "#instagram",         color: "text-pink-400",     url: "/integrations?slug=instagram-dm",       group: "integration" },
  { id: "telegram",          label: "#telegram",          color: "text-sky-400",      url: "/integrations?slug=telegram",           group: "integration" },
  { id: "facebook",          label: "#facebook",          color: "text-blue-500",     url: "/integrations?slug=facebook-messenger", group: "integration" },
  { id: "tiktok",            label: "#tiktok",            color: "text-zinc-100",     url: "/integrations?slug=tiktok",             group: "integration" },
  { id: "linkedin",          label: "#linkedin",          color: "text-blue-400",     url: "/integrations?slug=linkedin",           group: "integration" },
  { id: "slack",             label: "#slack",             color: "text-yellow-400",   url: "/integrations?slug=slack",              group: "integration" },
  { id: "discord",           label: "#discord",           color: "text-indigo-400",   url: "/integrations?slug=discord",            group: "integration" },
  { id: "microsoft-teams",   label: "#microsoft-teams",   color: "text-violet-400",   url: "/integrations?slug=microsoft-teams",    group: "integration" },
  { id: "gmail",             label: "#gmail",             color: "text-red-400",      url: "/integrations?slug=gmail",              group: "integration" },
  { id: "google-calendar",   label: "#google-calendar",   color: "text-blue-400",     url: "/integrations?slug=google-calendar",    group: "integration" },
  { id: "stripe",            label: "#stripe",            color: "text-violet-400",   url: "/integrations?slug=stripe",             group: "integration" },
  { id: "hubspot",           label: "#hubspot",           color: "text-orange-500",   url: "/integrations?slug=hubspot",            group: "integration" },
  { id: "openai",            label: "#openai",            color: "text-green-400",    url: "/integrations?slug=openai",             group: "integration" },
  { id: "zapier",            label: "#zapier",            color: "text-orange-400",   url: "/integrations?slug=zapier",             group: "integration" },
];

// ─── Todos os Apps (NASA + Integrações) ──────────────────────────────────────

export const allApps: AppItem[] = [...nasaApps, ...integrationApps];

// ─── Helper: todos os valores de variável ────────────────────────────────────

export const allVariableValues: string[] = variableCategories.flatMap(
  (cat) => cat.items.map((i) => i.value)
);

// ─── Helper: todos os labels de app ──────────────────────────────────────────

export const allAppLabels: string[] = allApps.map((a) => a.label);
