// Cadastro único dos recursos de IA da plataforma (spec 0093, D-5): o que usa IA, em qual App, com
// qual modelo e por qual regra de chave. É a fonte da tela "IA da empresa", do relatório de consumo
// e, na etapa 2, do seletor. Descreve o que o código faz HOJE, inclusive o que foge da regra.
// Sem `server-only`: a tela lê os rótulos daqui.

export type AiProviderName = "openai" | "google" | "anthropic";

export type AiResourceKind = "text" | "voice" | "transcription" | "speech" | "image" | "video";

/** De onde a chave sai, na ordem em que o recurso procura. */
export type AiKeyRule =
  /** Chave da empresa em Satélites; sem ela, a da plataforma. É a regra que o produto quer para tudo. */
  | "company-then-platform"
  /** Chave do próprio funil; sem ela, a da plataforma. Não olha Satélites. */
  | "funnel-then-platform"
  /** Só a chave da plataforma, mesmo que a empresa tenha a dela. */
  | "platform-only"
  /** Plataforma primeiro e só depois a empresa: ordem invertida. */
  | "platform-then-company"
  /** Só a chave da empresa: sem ela, o recurso não roda. */
  | "company-only"
  /** Serviço gratuito, sem chave. */
  | "free";

export type AiModelRule =
  /** Escolhido pelo seletor central, pela faixa do catálogo e pelo provedor que tiver chave. */
  | { kind: "tier"; tier: "FAST" | "SMART" | "DEEP" }
  /** Fixo no código. */
  | { kind: "fixed"; provider: AiProviderName | "other"; modelId: string }
  /** Tenta os modelos nesta ordem e usa o primeiro que tiver chave. */
  | { kind: "cascade"; options: { provider: AiProviderName; modelId: string }[] }
  /** O que o funil escolheu; sem escolha, o padrão da plataforma. */
  | { kind: "funnel" }
  /** Voz em tempo real: o modelo de voz da plataforma. */
  | { kind: "realtime-voice" };

export type AiSettingsPlace = "satellites" | "funnel" | "astro" | "none";

export interface AiResource {
  id: string;
  app: string;
  label: string;
  /** O que a pessoa percebe na tela quando este recurso roda. */
  description: string;
  kind: AiResourceKind;
  keyRule: AiKeyRule;
  model: AiModelRule;
  /** Sem chave da empresa, o recurso roda num serviço gratuito em vez de parar. */
  freeFallbackModelId?: string;
  /** Um resultado por funil: cada funil pode ter chave e modelo próprios. */
  isPerTracking?: boolean;
  /** Nomes com que o uso deste recurso aparece em `usage_event` (`feature` e `action`). */
  usageFeatures: string[];
  usageActions: string[];
  /** Onde a pessoa configura isto hoje. */
  settingsPlace: AiSettingsPlace;
}

export const AI_RESOURCES: AiResource[] = [
  // ── Astro ────────────────────────────────────────────────────────────────────────────────
  {
    id: "astro.chat",
    app: "Astro",
    label: "Conversa com o Astro",
    description: "O copiloto da equipe na Início e no WhatsApp, incluindo os comandos agendados.",
    kind: "text",
    keyRule: "company-then-platform",
    model: { kind: "tier", tier: "SMART" },
    usageFeatures: ["astro.orchestrator", "astro.whatsapp", "astro.commander", "astro.classifier"],
    usageActions: ["astro_tokens", "astro_prompt", "astro_command_run"],
    settingsPlace: "astro",
  },
  {
    id: "astro.voice",
    app: "Astro",
    label: "Conversa por voz com o Astro",
    description: "Falar com o Astro na Início, em tempo real.",
    kind: "voice",
    keyRule: "company-then-platform",
    model: { kind: "realtime-voice" },
    usageFeatures: ["astro.voice", "astro_voice"],
    usageActions: ["astro_voice", "astro_voice_minute"],
    settingsPlace: "astro",
  },
  {
    id: "astro.speech",
    app: "Astro",
    label: "Voz padrão do Astro",
    description: "O Astro lendo a resposta em voz alta.",
    kind: "speech",
    keyRule: "company-then-platform",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4o-mini-tts" },
    usageFeatures: ["astro.voice.standard"],
    usageActions: ["astro_voice_speech"],
    settingsPlace: "astro",
  },
  {
    id: "astro.build-flow",
    app: "Astro",
    label: "Criar fluxo com o Astro",
    description: "Montar um fluxo de automação a partir de uma frase.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4o" },
    usageFeatures: ["workflow.generate"],
    usageActions: ["workflow_generate"],
    settingsPlace: "none",
  },
  {
    id: "astro.build-attendance",
    app: "Astro",
    label: "Montar o atendimento pelo site ou por um roteiro",
    description: "Ler o site ou o roteiro da empresa e preparar documento, menu e fluxos.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4.1-mini" },
    usageFeatures: ["astro.attendance.site_read", "astro.attendance.script_read"],
    usageActions: ["astro_attendance_setup_from_site", "astro_attendance_setup_from_script"],
    settingsPlace: "none",
  },

  // ── Tracking: atendimento, ligações, chat, leads ─────────────────────────────────────────
  {
    id: "attendance.chat",
    app: "Atendimento",
    label: "Atendimento do funil por texto",
    description: "A assistente respondendo o cliente no WhatsApp, e o teste dela na tela de configuração.",
    kind: "text",
    keyRule: "funnel-then-platform",
    model: { kind: "funnel" },
    isPerTracking: true,
    usageFeatures: ["tracking-chat-ai.agent", "tracking-chat-ai.attendance-test"],
    usageActions: ["chat_ai_message"],
    settingsPlace: "funnel",
  },
  {
    id: "attendance.speech",
    app: "Atendimento",
    label: "Resposta em áudio",
    description: "A assistente respondendo o cliente com áudio.",
    kind: "speech",
    keyRule: "company-then-platform",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4o-mini-tts" },
    usageFeatures: ["astro.whatsapp.speech"],
    usageActions: ["astro_bot_speech"],
    settingsPlace: "funnel",
  },
  {
    id: "attendance.transcription",
    app: "Atendimento",
    label: "Transcrever áudio recebido",
    description: "Entender o áudio que o cliente ou a equipe mandou pelo WhatsApp.",
    kind: "transcription",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "whisper-1" },
    usageFeatures: ["tracking-chat-ai.audio", "astro.whatsapp.audio"],
    usageActions: ["astro_bot_transcription"],
    settingsPlace: "none",
  },
  {
    id: "calls.voice",
    app: "Ligações",
    label: "Ligação de voz pelo WhatsApp",
    description: "A assistente atendendo a ligação do cliente, e a equipe ligando para o Astro.",
    kind: "voice",
    keyRule: "company-then-platform",
    model: { kind: "realtime-voice" },
    usageFeatures: ["astro.whatsapp.call"],
    usageActions: ["astro_whatsapp_call_minute"],
    settingsPlace: "funnel",
  },
  {
    id: "calls.tagging",
    app: "Ligações",
    label: "Tags depois da ligação",
    description: "Ler a transcrição da ligação e sugerir as tags do lead.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4.1-mini" },
    usageFeatures: ["astro.whatsapp.call.tagging"],
    usageActions: ["astro_whatsapp_call_tagging"],
    settingsPlace: "none",
  },
  {
    id: "chat.assist",
    app: "Chat",
    label: "Resumo da conversa e sugestão de resposta",
    description: "Os botões de resumir a conversa e de compor a resposta para o atendente.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "google", modelId: "gemini-2.5-flash" },
    usageFeatures: ["chat.summary", "chat.compose"],
    usageActions: ["generate_summary", "generate_compose"],
    settingsPlace: "none",
  },
  {
    id: "leads.audit",
    app: "Tracking",
    label: "Auditoria do lead",
    description: "A análise do lead feita pela IA.",
    kind: "text",
    keyRule: "company-then-platform",
    model: { kind: "tier", tier: "FAST" },
    usageFeatures: ["leads.audit"],
    usageActions: ["lead_audit_ai"],
    settingsPlace: "satellites",
  },
  {
    id: "tracking.assistant",
    app: "Tracking",
    label: "Criar lead ou funil por conversa",
    description: "O assistente lateral do funil.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4.1-nano" },
    usageFeatures: ["tracking.assistant"],
    usageActions: ["tracking_assistant"],
    settingsPlace: "none",
  },

  // ── Gatilhos Automáticos ─────────────────────────────────────────────────────────────────
  {
    id: "workflows.ai-steps",
    app: "Gatilhos Automáticos",
    label: "Passos de IA dos fluxos",
    description: "Decisão por IA, gerar texto, ler imagem e ler PDF dentro de um fluxo.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4o-mini" },
    usageFeatures: ["workflow.agent"],
    usageActions: ["workflow_ai_node", "ai_decision_made", "ai_text_generated", "ai_vision_analyzed", "pdf_read"],
    settingsPlace: "none",
  },
  {
    id: "workflows.web-search",
    app: "Gatilhos Automáticos",
    label: "Busca na web no fluxo",
    description: "O passo que procura uma informação atual na internet.",
    kind: "text",
    keyRule: "platform-only",
    model: {
      kind: "cascade",
      options: [
        { provider: "google", modelId: "gemini-2.5-flash" },
        { provider: "openai", modelId: "gpt-4o-mini" },
      ],
    },
    usageFeatures: ["workflow.web-search"],
    usageActions: ["web_search_executed"],
    settingsPlace: "none",
  },
  {
    id: "workflows.speech",
    app: "Gatilhos Automáticos",
    label: "Enviar voz no fluxo",
    description: "O passo que manda um áudio gerado por IA.",
    kind: "speech",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "tts-1" },
    usageFeatures: ["workflow.speech"],
    usageActions: ["send_voice_generated"],
    settingsPlace: "none",
  },
  {
    id: "workflows.quick-builder",
    app: "Gatilhos Automáticos",
    label: "Modo rápido",
    description: "Montar os passos de um gatilho a partir de uma frase.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4o" },
    usageFeatures: ["workflow.quick-builder"],
    usageActions: ["workflow_quick_draft"],
    settingsPlace: "none",
  },

  // ── Workspace, Insights, Financeiro ──────────────────────────────────────────────────────
  {
    id: "workspace.assistant",
    app: "Workspace",
    label: "Criar ação por conversa",
    description: "O assistente que cria e organiza ações do workspace.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4.1-nano" },
    usageFeatures: ["workspace.assistant"],
    usageActions: ["workspace_assistant"],
    settingsPlace: "none",
  },
  {
    id: "insights.report",
    app: "Insights",
    label: "Relatório com IA",
    description: "O resumo escrito dos números do período.",
    kind: "text",
    keyRule: "company-then-platform",
    model: { kind: "tier", tier: "SMART" },
    usageFeatures: ["insights.report"],
    usageActions: ["insights_report_ai"],
    settingsPlace: "satellites",
  },
  {
    id: "insights.narrative",
    app: "Insights",
    label: "Narrativa de um bloco",
    description: "O texto que explica um gráfico do painel.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "anthropic", modelId: "claude-haiku-4-5" },
    usageFeatures: ["insights.narrative"],
    usageActions: ["insights_tile_narrative"],
    settingsPlace: "none",
  },
  {
    id: "finance.documents",
    app: "Financeiro",
    label: "Ler boleto, nota, comprovante e extrato",
    description: "Tirar os dados de um documento financeiro ou contábil enviado.",
    kind: "text",
    keyRule: "company-then-platform",
    model: {
      kind: "cascade",
      options: [
        { provider: "openai", modelId: "gpt-4o-mini" },
        { provider: "google", modelId: "gemini-2.5-flash-lite" },
        { provider: "anthropic", modelId: "claude-haiku-4-5" },
      ],
    },
    usageFeatures: ["finance.documents"],
    usageActions: ["astro_finance_document", "astro_finance_statement_pdf"],
    settingsPlace: "satellites",
  },
  {
    id: "star-friends.receipt",
    app: "STAR FRIENDS",
    label: "Ler cupom da campanha de sorteio",
    description: "Tirar valor, data e número do cupom que o cliente envia pelo WhatsApp.",
    kind: "text",
    keyRule: "company-then-platform",
    model: {
      kind: "cascade",
      options: [
        { provider: "openai", modelId: "gpt-4o" },
        { provider: "google", modelId: "gemini-2.5-flash-lite" },
        { provider: "anthropic", modelId: "claude-haiku-4-5" },
      ],
    },
    usageFeatures: ["star-friends.receipt"],
    usageActions: ["ai_vision_analyzed"],
    settingsPlace: "satellites",
  },
  {
    id: "catalog.delivery-date",
    app: "Catálogo online",
    label: "Ler o prazo de entrega escrito pela equipe",
    description: "Transformar \"amanhã 11h\" na data da previsão de entrega na aprovação do pedido.",
    kind: "text",
    keyRule: "company-then-platform",
    model: {
      kind: "cascade",
      options: [
        { provider: "openai", modelId: "gpt-4o-mini" },
        { provider: "google", modelId: "gemini-2.5-flash-lite" },
        { provider: "anthropic", modelId: "claude-haiku-4-5" },
      ],
    },
    usageFeatures: ["catalog.delivery-date"],
    usageActions: ["ai_text_generated"],
    settingsPlace: "satellites",
  },
  {
    id: "finance.budget",
    app: "Financeiro",
    label: "Extrair orçamento de um documento",
    description: "Ler um orçamento e preencher os itens.",
    kind: "text",
    keyRule: "platform-then-company",
    model: { kind: "fixed", provider: "anthropic", modelId: "claude-haiku-4-5" },
    usageFeatures: ["finance.budget"],
    usageActions: ["extract_budget"],
    settingsPlace: "satellites",
  },

  // ── Planner e Marca ──────────────────────────────────────────────────────────────────────
  {
    id: "planner.scripts",
    app: "Planner",
    label: "Roteiro da semana e roteiros do kit de marca",
    description: "Os roteiros de conteúdo gerados pelo Planner.",
    kind: "text",
    keyRule: "company-then-platform",
    model: { kind: "tier", tier: "SMART" },
    usageFeatures: ["planner.scripts"],
    usageActions: ["planner_script"],
    settingsPlace: "satellites",
  },
  {
    id: "planner.post-text",
    app: "Planner",
    label: "Legenda e texto do post",
    description: "O texto do post e o briefing de campanha.",
    kind: "text",
    keyRule: "free",
    model: { kind: "fixed", provider: "other", modelId: "Pollinations" },
    usageFeatures: ["planner.post.generate", "onboarding.campanha"],
    usageActions: ["planner_post_generate", "planner_campaign_create"],
    settingsPlace: "none",
  },
  {
    id: "planner.image",
    app: "Planner",
    label: "Imagem do post",
    description: "A arte gerada por IA para o post.",
    kind: "image",
    keyRule: "company-only",
    model: { kind: "fixed", provider: "openai", modelId: "dall-e-3" },
    freeFallbackModelId: "Pollinations",
    usageFeatures: ["planner.image.prompt", "planner.image.post", "planner.image.reference"],
    usageActions: ["planner_image_prompt", "planner_post_image", "planner_image_reference"],
    settingsPlace: "satellites",
  },
  {
    id: "planner.video",
    app: "Planner",
    label: "Clipe de vídeo",
    description: "O vídeo curto gerado por IA.",
    kind: "video",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "other", modelId: "fal.ai Kling" },
    usageFeatures: ["planner.video.generate"],
    usageActions: ["planner_video_generate"],
    settingsPlace: "none",
  },
  {
    id: "planner.transcription",
    app: "Planner",
    label: "Transcrever vídeo",
    description: "Passar a fala de um vídeo para texto.",
    kind: "transcription",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "whisper-1" },
    usageFeatures: ["planner.transcription"],
    usageActions: ["planner_transcription"],
    settingsPlace: "none",
  },
  {
    id: "brand.extract",
    app: "Marca",
    label: "Extrair a marca e gerar o guia",
    description: "Ler o logo ou o site e montar cores, tom de voz e guia.",
    kind: "text",
    keyRule: "platform-then-company",
    model: { kind: "fixed", provider: "anthropic", modelId: "claude-haiku-4-5" },
    usageFeatures: ["brand.extract"],
    usageActions: ["brand_extract"],
    settingsPlace: "satellites",
  },

  // ── Explorer, Tráfego, Comments, Formulários, Agenda, site ───────────────────────────────
  {
    id: "explorer.command",
    app: "Explorer",
    label: "Interpretar o comando e gerar conteúdo",
    description: "A barra de comando da plataforma.",
    kind: "text",
    keyRule: "company-only",
    model: {
      kind: "cascade",
      options: [
        { provider: "anthropic", modelId: "claude-haiku-4-5" },
        { provider: "openai", modelId: "gpt-4o-mini" },
        { provider: "google", modelId: "gemini-2.0-flash" },
      ],
    },
    usageFeatures: ["nasa-command.intent"],
    usageActions: ["nasa_command_intent", "nasa_command"],
    settingsPlace: "satellites",
  },
  {
    id: "trafego.assistant",
    app: "Tráfego",
    label: "Assistente, recomendações e textos de anúncio",
    description: "As sugestões de IA do Tráfego.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4o-mini" },
    usageFeatures: ["trafego.assistant", "trafego.recommendations", "trafego.release", "trafego.copies"],
    usageActions: ["trafego_ai"],
    settingsPlace: "none",
  },
  {
    id: "trafego.compliance",
    app: "Tráfego",
    label: "Conformidade do anúncio",
    description: "A checagem do anúncio contra as regras da plataforma de mídia.",
    kind: "text",
    keyRule: "platform-then-company",
    model: { kind: "fixed", provider: "anthropic", modelId: "claude-haiku-4-5" },
    usageFeatures: ["trafego.compliance"],
    usageActions: ["trafego_compliance"],
    settingsPlace: "none",
  },
  {
    id: "comments.reply",
    app: "Comments",
    label: "Responder comentário com IA",
    description: "A resposta automática a comentários nas redes.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4o-mini" },
    usageFeatures: ["comments.reply"],
    usageActions: ["comments_ai_reply"],
    settingsPlace: "none",
  },
  {
    id: "forms.assistant",
    app: "Formulários",
    label: "Assistente do construtor de formulários",
    description: "Sugerir perguntas e textos ao montar um formulário.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "google", modelId: "gemini-2.0-flash-exp" },
    usageFeatures: ["forms.assistant"],
    usageActions: ["forms_assistant"],
    settingsPlace: "none",
  },
  {
    id: "agenda.booking-chat",
    app: "Agenda",
    label: "Chat público de agendamento",
    description: "O chat em que o cliente marca horário pela página da agenda.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "google", modelId: "gemini-2.5-flash" },
    usageFeatures: ["booking-chat.message"],
    usageActions: ["booking_chat_message"],
    settingsPlace: "none",
  },
  {
    id: "agenda.event-from-image",
    app: "Agenda",
    label: "Criar evento a partir de uma imagem",
    description: "Ler um convite ou cartaz e preencher o evento.",
    kind: "text",
    keyRule: "platform-then-company",
    model: { kind: "fixed", provider: "anthropic", modelId: "claude-haiku-4-5" },
    usageFeatures: ["public-calendar.event-from-image"],
    usageActions: ["calendar_event_from_image"],
    settingsPlace: "none",
  },
  {
    id: "site.astro-chat",
    app: "Astro Chat do site",
    label: "Atendimento público no site",
    description: "O chat do Astro embutido no site da empresa.",
    kind: "text",
    keyRule: "platform-only",
    model: { kind: "fixed", provider: "openai", modelId: "gpt-4.1-mini" },
    usageFeatures: ["astro-chat.public-agent"],
    usageActions: ["astro_chat_ai_message"],
    settingsPlace: "none",
  },
];

export const AI_RESOURCE_BY_ID = new Map(AI_RESOURCES.map((resource) => [resource.id, resource]));

/** A qual recurso pertence uma linha de uso. `feature` é mais específico e vence `action`. */
export function findAiResourceForUsage(usage: { feature?: string | null; action?: string | null }): AiResource | null {
  if (usage.feature) {
    const byFeature = AI_RESOURCES.find((resource) => resource.usageFeatures.includes(usage.feature!));
    if (byFeature) return byFeature;
  }
  if (usage.action) {
    const byAction = AI_RESOURCES.find((resource) => resource.usageActions.includes(usage.action!));
    if (byAction) return byAction;
  }
  return null;
}

export const KEY_RULE_LABEL: Record<AiKeyRule, string> = {
  "company-then-platform": "Sua chave; sem ela, a da plataforma",
  "funnel-then-platform": "Chave do funil; sem ela, a da plataforma",
  "platform-only": "Só a chave da plataforma",
  "platform-then-company": "Plataforma primeiro, depois a sua",
  "company-only": "Só com a sua chave",
  free: "Serviço gratuito, sem chave",
};
