export interface StarRuleDefinition {
  action: string;
  label: string;
  stars: number;
  cooldownHours: number | null;
  category: string;
}

export const DEFAULT_STAR_RULES: StarRuleDefinition[] = [
  // CRM / Leads
  {
    action: "lead_create",
    label: "Criar novo lead",
    stars: 1,
    cooldownHours: null,
    category: "leads",
  },
  {
    action: "lead_import_batch",
    label: "Importar leads (por lead)",
    stars: 1,
    cooldownHours: null,
    category: "leads",
  },
  {
    action: "lead_tracking_create",
    label: "Criar tracking (pipeline)",
    stars: 2,
    cooldownHours: null,
    category: "leads",
  },
  {
    action: "lead_stage_move",
    label: "Mover lead de etapa",
    stars: 1,
    cooldownHours: null,
    category: "leads",
  },
  // NASA Command / IA
  {
    action: "ai_command_execute",
    label: "Executar comando de IA",
    stars: 5,
    cooldownHours: null,
    category: "ai",
  },
  {
    action: "ai_entity_search",
    label: "Busca de entidade (IA search)",
    stars: 2,
    cooldownHours: null,
    category: "ai",
  },
  {
    action: "ai_response_generate",
    label: "Gerar resposta por IA",
    stars: 5,
    cooldownHours: null,
    category: "ai",
  },
  // Forge
  {
    action: "forge_proposal_create",
    label: "Criar proposta",
    stars: 3,
    cooldownHours: null,
    category: "forge",
  },
  {
    action: "forge_proposal_send",
    label: "Enviar proposta ao cliente",
    stars: 2,
    cooldownHours: null,
    category: "forge",
  },
  {
    action: "forge_contract_create",
    label: "Gerar contrato",
    stars: 3,
    cooldownHours: null,
    category: "forge",
  },
  {
    action: "forge_contract_sign",
    label: "Assinar contrato (digital)",
    stars: 2,
    cooldownHours: null,
    category: "forge",
  },
  // NASA Planner
  {
    action: "planner_create",
    label: "Criar planner / mind map",
    stars: 2,
    cooldownHours: null,
    category: "planner",
  },
  {
    action: "planner_post_ai",
    label: "Gerar post com IA",
    stars: 5,
    cooldownHours: null,
    category: "planner",
  },
  {
    action: "planner_post_schedule",
    label: "Agendar post",
    stars: 1,
    cooldownHours: null,
    category: "planner",
  },
  // Workflows & Automações
  {
    action: "workflow_create",
    label: "Criar automação",
    stars: 3,
    cooldownHours: null,
    category: "automation",
  },
  {
    action: "workflow_execute",
    label: "Executar automação (trigger)",
    stars: 2,
    cooldownHours: null,
    category: "automation",
  },
  {
    action: "workflow_trigger_create",
    label: "Criar trigger de evento",
    stars: 1,
    cooldownHours: null,
    category: "automation",
  },
  // Agenda
  {
    action: "agenda_create",
    label: "Criar agenda",
    stars: 1,
    cooldownHours: null,
    category: "agenda",
  },
  {
    action: "appointment_create",
    label: "Criar agendamento",
    stars: 1,
    cooldownHours: null,
    category: "agenda",
  },
  {
    action: "appointment_reminder",
    label: "Enviar lembrete automático",
    stars: 2,
    cooldownHours: null,
    category: "agenda",
  },
  // Chat
  {
    action: "chat_ai_reply",
    label: "Resposta automática por IA no chat",
    stars: 5,
    cooldownHours: null,
    category: "chat",
  },
  {
    action: "chat_whatsapp_template",
    label: "Enviar template WhatsApp",
    stars: 2,
    cooldownHours: null,
    category: "chat",
  },
  // ── Cobranças adicionais — Sprint correção STARS ─────────
  {
    action: "chat_ai_message",
    label: "Chat AI WhatsApp — resposta IA",
    stars: 2,
    cooldownHours: null,
    category: "chat",
  },
  {
    action: "message_send",
    label: "Mensagem outbound (WhatsApp/IG/FB)",
    stars: 1,
    cooldownHours: null,
    category: "chat",
  },
  {
    action: "extract_budget",
    label: "OCR de Orçamento (Claude Vision)",
    stars: 5,
    cooldownHours: null,
    category: "ai",
  },
  {
    action: "transcribe_video",
    label: "Transcrição de vídeo (Whisper, por minuto)",
    stars: 1,
    cooldownHours: null,
    category: "ai",
  },
  {
    action: "generate_compose",
    label: "Composição de mensagem por IA",
    stars: 2,
    cooldownHours: null,
    category: "ai",
  },
  {
    action: "generate_summary",
    label: "Resumo de conversa por IA",
    stars: 2,
    cooldownHours: null,
    category: "ai",
  },
  {
    action: "nasa_command_intent",
    label: "NASA Command — parser de intent (IA)",
    stars: 1,
    cooldownHours: null,
    category: "ai",
  },
  {
    action: "workspace_email_send",
    label: "Email de workspace (Resend)",
    stars: 1,
    cooldownHours: null,
    category: "workspace",
  },
  // Forms
  {
    action: "form_create",
    label: "Criar formulário",
    stars: 1,
    cooldownHours: null,
    category: "forms",
  },
  {
    action: "form_response_collect",
    label: "Coletar resposta de formulário",
    stars: 1,
    cooldownHours: null,
    category: "forms",
  },
  // N.Box
  {
    action: "nbox_upload",
    label: "Upload de arquivo no N.Box",
    stars: 1,
    cooldownHours: null,
    category: "nbox",
  },
  // Workspace
  {
    action: "workspace_board_create",
    label: "Criar workspace/board",
    stars: 2,
    cooldownHours: null,
    category: "workspace",
  },
  {
    action: "workspace_card_create",
    label: "Criar card/tarefa",
    stars: 1,
    cooldownHours: null,
    category: "workspace",
  },
  // Integrações
  {
    action: "integration_setup",
    label: "Ativar integração (setup)",
    stars: 10,
    cooldownHours: null,
    category: "integration",
  },
  {
    action: "integration_monthly",
    label: "Uso mensal de integração",
    stars: 5,
    cooldownHours: null,
    category: "integration",
  },
  {
    action: "integration_sync",
    label: "Sync de dados (por execução)",
    stars: 2,
    cooldownHours: null,
    category: "integration",
  },
  // Analytics
  {
    action: "insights_report_ai",
    label: "Gerar relatório com IA",
    stars: 5,
    cooldownHours: null,
    category: "insights",
  },
  {
    action: "insights_export",
    label: "Exportar dados",
    stars: 2,
    cooldownHours: null,
    category: "insights",
  },
  // Alertas (stars debit = 0, but trigger popup)
  {
    action: "stars_balance_low",
    label: "Saldo de STARs < 20% (alerta)",
    stars: 0,
    cooldownHours: null,
    category: "system",
  },
  {
    action: "stars_balance_zero",
    label: "Saldo de STARs = 0 (bloqueio)",
    stars: 0,
    cooldownHours: null,
    category: "system",
  },
  {
    action: "plan_renewed",
    label: "Plano renovado (mensal)",
    stars: 0,
    cooldownHours: null,
    category: "system",
  },
  // ── Tracking Chat 2.0 — Sprint 1 (telefonia básica + vídeo) ──
  // `livekit_lead_call` cobra na inicialização da sala (LiveKit). Sprint 2
  // cobrará por minuto via Egress webhook. `tel_link_dial` é 0★ (a
  // ligação acontece via operadora do usuário, NASA não cobra).
  {
    action: "livekit_lead_call",
    label: "Chamada de vídeo/áudio com lead (LiveKit)",
    stars: 2,
    cooldownHours: null,
    category: "chat",
  },
  {
    action: "tel_link_dial",
    label: "Ligação via tel: link (nativo do SO)",
    stars: 0,
    cooldownHours: null,
    category: "chat",
  },
  // Importação manual de conversas existentes do WhatsApp via uazapi
  // `/chat/find`. Cobra fixo por BATCH (até 50 conversas). On-demand
  // sempre — sem ban risk porque é leitura pura (mesma operação do
  // WhatsApp Web), com throttle interno.
  {
    action: "chat_import_existing",
    label: "Importar conversas existentes do WhatsApp",
    stars: 5,
    cooldownHours: null,
    category: "chat",
  },

  // ── NASA Planner 2.0 — Sprint 1 (Brand Kit + 5W2H + Chat IA) ──
  // Disparadas por procedures novas em src/app/router/brand/* e
  // src/app/router/nasa-planner/* (campaign-brief / ai-chat-route).
  {
    action: "brand_extract",
    label: "Extração de Brand Kit (Claude Vision)",
    stars: 5,
    cooldownHours: null,
    category: "planner",
  },
  {
    action: "campaign_brief_5w2h",
    label: "Brief de Campanha 5W2H (IA)",
    stars: 5,
    cooldownHours: null,
    category: "planner",
  },
  {
    action: "planner_ai_intent",
    label: "Comando do Chat IA do Planner",
    stars: 1,
    cooldownHours: null,
    category: "planner",
  },
];

export const STAR_RULE_CATEGORY_LABEL: Record<string, string> = {
  leads: "CRM / Leads",
  ai: "IA & NASA Command",
  forge: "Forge",
  planner: "NASA Planner",
  automation: "Workflows & Automações",
  agenda: "Agenda",
  chat: "Chat & Mensagens",
  forms: "Formulários",
  nbox: "N.Box",
  workspace: "Workspace",
  integration: "Integrações",
  insights: "Analytics & Insights",
  system: "Sistema / Alertas",
  custom: "Personalizada",
};
