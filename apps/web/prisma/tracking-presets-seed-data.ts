import type { PresetSpec } from "@/features/tracking-presets/lib/preset-spec.schema";
import { comercialMenuInterativoSpec } from "./comercial-menu-interativo-spec";

/**
 * 4 presets MVP — 1 por paradigma.
 *
 * Cada spec define o tracking COMPLETO (status, tags, workflows com nodes
 * referenciando slugs). O apply remapeia slugs → IDs reais via Maps.
 *
 * Importante: NodeType strings devem bater EXATAMENTE com o enum NodeType
 * em prisma/schema.prisma. Se mudar o enum, atualizar os specs aqui.
 */

// ── 1. Closer Comercial Reativo ────────────────────────────────────────────
// Cliente entra em contato → IA acolhe → tag aplicada → automação dispara.
// Foco em conversão por proposta.
const closerReativo: PresetSpec = {
  tracking: {
    name: "Closer Comercial — Reativo",
    description:
      "Fluxo focado em conversão por proposta quando o cliente entra em contato. IA acolhe, qualifica, envia material e move pra negociação.",
    ai: {
      assistantName: "Closer Bot",
      prompt:
        "Você é o assistente comercial da empresa. Sua missão é qualificar leads que chegam pelo WhatsApp e direcionar pra fechamento. Quando o cliente perguntar sobre preços ou produtos, envie a proposta. Quando demonstrar interesse forte, ofereça agenda com um humano. Mantenha tom consultivo, não agressivo.",
      finishSentence:
        "Quando o cliente disser que quer falar com um humano, fechar negócio agora, ou fizer pergunta muito específica que precisa de atendente",
    },
  },
  status: [
    { slug: "novo-lead", name: "Novo Lead", color: "#FF6B6B", order: 0 },
    { slug: "em-qualificacao", name: "Em Qualificação", color: "#FFA500", order: 1 },
    { slug: "proposta-enviada", name: "Proposta Enviada", color: "#FFD700", order: 2 },
    { slug: "negociacao", name: "Negociação", color: "#7A5FDF", order: 3 },
    { slug: "fechado", name: "Fechado", color: "#3DB88B", order: 4 },
    { slug: "perdido", name: "Perdido", color: "#888888", order: 5 },
  ],
  winLossReasons: [
    { name: "Bom preço", type: "WIN" },
    { name: "Atendimento", type: "WIN" },
    { name: "Indicação forte", type: "WIN" },
    { name: "Sem orçamento", type: "LOSS" },
    { name: "Concorrente", type: "LOSS" },
    { name: "Timing ruim", type: "LOSS" },
  ],
  tagGroups: [
    { slug: "prioridade", name: "Prioridade", color: "#FF6B6B" },
    { slug: "origem", name: "Origem", color: "#4ECDC4" },
  ],
  tags: [
    { slug: "vip", name: "VIP", color: "#FFD700", groupSlug: "prioridade" },
    { slug: "quente", name: "Quente", color: "#FF6B6B", groupSlug: "prioridade" },
    { slug: "inbound", name: "Inbound", color: "#9C27B0", groupSlug: "origem" },
    { slug: "indicacao", name: "Indicação", color: "#3DB88B", groupSlug: "origem" },
  ],
  workflowFolders: [
    { slug: "core", name: "Automações Ativas", order: 0 },
    { slug: "biblioteca", name: "Padrões Extras (inativos)", order: 1 },
  ],
  workflows: [
    {
      slug: "tag-vip-envia-proposta",
      name: "Tag VIP → Envia Proposta",
      description: "Quando lead recebe tag VIP, envia proposta padrão",
      folderSlug: "core",
      isActive: true,
      agentMode: false,
      nodes: [
        {
          tempId: "t1",
          type: "LEAD_TAGGED",
          position: { x: 0, y: 0 },
          data: { tagSlugs: ["vip"] },
        },
        {
          tempId: "a1",
          type: "SEND_PROPOSAL",
          position: { x: 320, y: 0 },
          data: {},
        },
        {
          tempId: "a2",
          type: "MOVE_LEAD",
          position: { x: 640, y: 0 },
          data: { statusSlug: "proposta-enviada" },
        },
      ],
      connections: [
        { fromTempId: "t1", toTempId: "a1", fromOutput: "source-1", toInput: "target-1" },
        { fromTempId: "a1", toTempId: "a2", fromOutput: "source-1", toInput: "target-1" },
      ],
    },
    {
      slug: "tag-quente-agenda",
      name: "Tag Quente → Envia Agenda",
      description: "Lead quente ganha link de agenda direto",
      folderSlug: "core",
      isActive: true,
      agentMode: false,
      nodes: [
        {
          tempId: "t1",
          type: "LEAD_TAGGED",
          position: { x: 0, y: 0 },
          data: { tagSlugs: ["quente"] },
        },
        {
          tempId: "a1",
          type: "SEND_AGENDA",
          position: { x: 320, y: 0 },
          data: {},
        },
      ],
      connections: [
        { fromTempId: "t1", toTempId: "a1", fromOutput: "source-1", toInput: "target-1" },
      ],
    },
    {
      slug: "indicacao-mensagem-boas-vindas",
      name: "Indicação → Mensagem Especial",
      description: "Lead via indicação recebe boas-vindas personalizadas",
      folderSlug: "biblioteca",
      isActive: false,
      agentMode: false,
      nodes: [
        {
          tempId: "t1",
          type: "LEAD_TAGGED",
          position: { x: 0, y: 0 },
          data: { tagSlugs: ["indicacao"] },
        },
        {
          tempId: "a1",
          type: "SEND_MESSAGE",
          position: { x: 320, y: 0 },
          data: {
            message:
              "Que ótimo que você chegou via indicação! Já preparei um material exclusivo pra você. Quer dar uma olhada?",
          },
        },
      ],
      connections: [
        { fromTempId: "t1", toTempId: "a1", fromOutput: "source-1", toInput: "target-1" },
      ],
    },
  ],
};

// ── 2. SDR Proativo ─────────────────────────────────────────────────────────
// Empresa age antes do cliente pedir. Novo lead → mensagem boas-vindas →
// form qualificação → tag inbound → distribui.
const sdrProativo: PresetSpec = {
  tracking: {
    name: "SDR — Proativo",
    description:
      "Pipeline proativo: novo lead → boas-vindas → qualificação via form → tag automática → distribui pro closer adequado.",
    ai: {
      assistantName: "SDR Bot",
      prompt:
        "Você é o assistente de pré-vendas (SDR). Sua missão é qualificar leads novos com algumas perguntas rápidas e direcionar pro closer certo. Seja amigável, curto e direto. Sempre pergunte sobre necessidade e timing antes de orçamento.",
      finishSentence:
        "Quando o cliente terminar a qualificação ou pedir explicitamente um humano",
    },
  },
  status: [
    { slug: "novo", name: "Novo", color: "#FF6B6B", order: 0 },
    { slug: "qualificando", name: "Qualificando", color: "#FFA500", order: 1 },
    { slug: "qualificado", name: "Qualificado", color: "#3DB88B", order: 2 },
    { slug: "descartado", name: "Descartado", color: "#888888", order: 3 },
  ],
  winLossReasons: [
    { name: "ICP forte", type: "WIN" },
    { name: "Timing perfeito", type: "WIN" },
    { name: "Fora do ICP", type: "LOSS" },
    { name: "Sem fit", type: "LOSS" },
  ],
  tagGroups: [{ slug: "qualif", name: "Qualificação", color: "#4ECDC4" }],
  tags: [
    { slug: "inbound", name: "Inbound", color: "#9C27B0", groupSlug: "qualif" },
    { slug: "qualificado", name: "Qualificado", color: "#3DB88B", groupSlug: "qualif" },
    { slug: "nurturing", name: "Em Nurturing", color: "#FFA500", groupSlug: "qualif" },
  ],
  workflowFolders: [
    { slug: "core", name: "Automações Ativas", order: 0 },
    { slug: "biblioteca", name: "Padrões Extras (inativos)", order: 1 },
  ],
  workflows: [
    {
      slug: "novo-lead-boas-vindas",
      name: "Novo Lead → Mensagem + Form",
      description: "Novo lead recebe mensagem de boas-vindas e form de qualificação",
      folderSlug: "core",
      isActive: true,
      agentMode: false,
      nodes: [
        {
          tempId: "t1",
          type: "NEW_LEAD",
          position: { x: 0, y: 0 },
          data: {},
        },
        {
          tempId: "a1",
          type: "SEND_MESSAGE",
          position: { x: 320, y: 0 },
          data: {
            message:
              "Oi! Obrigado por entrar em contato. Pra te atender melhor, vou te enviar um formulário rápido (leva 1 minuto). Tudo bem?",
          },
        },
        {
          tempId: "a2",
          type: "SEND_FORM",
          position: { x: 640, y: 0 },
          data: {},
        },
        {
          tempId: "a3",
          type: "TAG",
          position: { x: 960, y: 0 },
          data: { tagIds: [], tagSlugs: ["inbound"] },
        },
      ],
      connections: [
        { fromTempId: "t1", toTempId: "a1", fromOutput: "source-1", toInput: "target-1" },
        { fromTempId: "a1", toTempId: "a2", fromOutput: "source-1", toInput: "target-1" },
        { fromTempId: "a2", toTempId: "a3", fromOutput: "source-1", toInput: "target-1" },
      ],
    },
    {
      slug: "qualificado-distribui",
      name: "Qualificado → Move Status",
      description: "Quando recebe tag Qualificado, move pra status Qualificado",
      folderSlug: "core",
      isActive: true,
      agentMode: false,
      nodes: [
        {
          tempId: "t1",
          type: "LEAD_TAGGED",
          position: { x: 0, y: 0 },
          data: { tagSlugs: ["qualificado"] },
        },
        {
          tempId: "a1",
          type: "MOVE_LEAD",
          position: { x: 320, y: 0 },
          data: { statusSlug: "qualificado" },
        },
      ],
      connections: [
        { fromTempId: "t1", toTempId: "a1", fromOutput: "source-1", toInput: "target-1" },
      ],
    },
  ],
};

// ── 3. Astro Preditivo ─────────────────────────────────────────────────────
// IA analisa conversa e dispara automação adequada (após finalizar).
const astroPreditivo: PresetSpec = {
  tracking: {
    name: "Astro — Preditivo (IA)",
    description:
      "A IA conversa, analisa intenção do cliente, segmenta com tag adequada e dispara automação. Requer Astro/IA configurado.",
    ai: {
      assistantName: "Astro",
      prompt:
        "Você é o Astro, IA preditiva da empresa. Conduza a conversa por completo: entenda o problema/desejo do cliente, faça perguntas estratégicas, classifique mentalmente o lead (frio/morno/quente) e finalize com a tag adequada. Após finalizar, o sistema vai disparar a automação correta automaticamente.",
      finishSentence:
        "Quando você tiver classificação clara do lead (frio/morno/quente) e tiver coletado dados suficientes pra próximo passo",
    },
  },
  status: [
    { slug: "analisando", name: "IA Analisando", color: "#7A5FDF", order: 0 },
    { slug: "frio", name: "Frio", color: "#1090E0", order: 1 },
    { slug: "morno", name: "Morno", color: "#FFA500", order: 2 },
    { slug: "quente", name: "Quente", color: "#FF6B6B", order: 3 },
    { slug: "conversao", name: "Conversão", color: "#3DB88B", order: 4 },
  ],
  winLossReasons: [
    { name: "Conversão IA", type: "WIN" },
    { name: "Descartado IA", type: "LOSS" },
  ],
  tagGroups: [{ slug: "temperatura", name: "Temperatura IA", color: "#7A5FDF" }],
  tags: [
    { slug: "frio", name: "Frio", color: "#1090E0", groupSlug: "temperatura" },
    { slug: "morno", name: "Morno", color: "#FFA500", groupSlug: "temperatura" },
    { slug: "quente", name: "Quente", color: "#FF6B6B", groupSlug: "temperatura" },
  ],
  workflowFolders: [
    { slug: "core", name: "Automações Ativas", order: 0 },
    { slug: "biblioteca", name: "Padrões Extras (inativos)", order: 1 },
  ],
  workflows: [
    {
      slug: "ai-finished-classifica",
      name: "IA Finalizou → Move por Tag",
      description: "Quando Astro finaliza conversa, move lead conforme tag de temperatura",
      folderSlug: "core",
      isActive: true,
      agentMode: false,
      nodes: [
        {
          tempId: "t1",
          type: "AI_FINISHED",
          position: { x: 0, y: 0 },
          data: {},
        },
        {
          tempId: "a1",
          type: "FILTER_LEAD",
          position: { x: 320, y: 0 },
          data: {
            conditions: [
              { field: "tags", op: "containsAny", tagSlugs: ["quente"] },
            ],
          },
        },
        {
          tempId: "a2",
          type: "MOVE_LEAD",
          position: { x: 640, y: 0 },
          data: { statusSlug: "quente" },
        },
        {
          tempId: "a3",
          type: "SEND_AGENDA",
          position: { x: 960, y: 0 },
          data: {},
        },
      ],
      connections: [
        { fromTempId: "t1", toTempId: "a1", fromOutput: "source-1", toInput: "target-1" },
        { fromTempId: "a1", toTempId: "a2", fromOutput: "source-1", toInput: "target-1" },
        { fromTempId: "a2", toTempId: "a3", fromOutput: "source-1", toInput: "target-1" },
      ],
    },
  ],
};

// ── 4. Self-Service Autoatendimento ─────────────────────────────────────────
// Cliente entra → menu → escolhe → form → NASA Route → fecha sozinho.
const selfService: PresetSpec = {
  tracking: {
    name: "Self-Service — Autoatendimento",
    description:
      "Cliente entra, escolhe produto via formulário e é direcionado pra NASA Route com curso ou onboarding. Sem intervenção humana.",
    ai: {
      assistantName: "Assistente Self-Service",
      prompt:
        "Você é o assistente de autoatendimento. Apresente o menu de opções (formulários disponíveis), aguarde o cliente escolher e envie o link adequado. Não tente vender — só direcione pra ferramenta certa.",
      finishSentence:
        "Quando o cliente confirmar a escolha e receber o link da ferramenta",
    },
  },
  status: [
    { slug: "explorando", name: "Explorando", color: "#FFA500", order: 0 },
    { slug: "em-form", name: "Em Formulário", color: "#9C27B0", order: 1 },
    { slug: "em-curso", name: "Em Curso", color: "#1090E0", order: 2 },
    { slug: "concluido", name: "Concluído", color: "#3DB88B", order: 3 },
  ],
  winLossReasons: [
    { name: "Curso concluído", type: "WIN" },
    { name: "Abandonou", type: "LOSS" },
  ],
  tagGroups: [{ slug: "jornada", name: "Jornada Self-Service", color: "#4ECDC4" }],
  tags: [
    { slug: "form-iniciado", name: "Form Iniciado", color: "#FFA500", groupSlug: "jornada" },
    { slug: "form-concluido", name: "Form Concluído", color: "#3DB88B", groupSlug: "jornada" },
    { slug: "curso-iniciado", name: "Curso Iniciado", color: "#1090E0", groupSlug: "jornada" },
  ],
  workflowFolders: [
    { slug: "core", name: "Automações Ativas", order: 0 },
    { slug: "biblioteca", name: "Padrões Extras (inativos)", order: 1 },
  ],
  workflows: [
    {
      slug: "primeira-interacao-envia-form",
      name: "Primeira Mensagem → Envia Form",
      description: "Cliente manda primeira mensagem, recebe form de escolha de produto",
      folderSlug: "core",
      isActive: true,
      agentMode: false,
      nodes: [
        {
          tempId: "t1",
          type: "FIRST_CHAT_INTERACTION",
          position: { x: 0, y: 0 },
          data: {},
        },
        {
          tempId: "a1",
          type: "SEND_FORM",
          position: { x: 320, y: 0 },
          data: {},
        },
        {
          tempId: "a2",
          type: "MOVE_LEAD",
          position: { x: 640, y: 0 },
          data: { statusSlug: "em-form" },
        },
      ],
      connections: [
        { fromTempId: "t1", toTempId: "a1", fromOutput: "source-1", toInput: "target-1" },
        { fromTempId: "a1", toTempId: "a2", fromOutput: "source-1", toInput: "target-1" },
      ],
    },
    {
      slug: "form-concluido-envia-route",
      name: "Form Concluído → Envia NASA Route",
      description: "Quando form é concluído, envia link do curso/route adequado",
      folderSlug: "core",
      isActive: true,
      agentMode: false,
      nodes: [
        {
          tempId: "t1",
          type: "LEAD_TAGGED",
          position: { x: 0, y: 0 },
          data: { tagSlugs: ["form-concluido"] },
        },
        {
          tempId: "a1",
          type: "SEND_NASA_ROUTE",
          position: { x: 320, y: 0 },
          data: {},
        },
        {
          tempId: "a2",
          type: "MOVE_LEAD",
          position: { x: 640, y: 0 },
          data: { statusSlug: "em-curso" },
        },
      ],
      connections: [
        { fromTempId: "t1", toTempId: "a1", fromOutput: "source-1", toInput: "target-1" },
        { fromTempId: "a1", toTempId: "a2", fromOutput: "source-1", toInput: "target-1" },
      ],
    },
  ],
};

export const SEED_PRESETS: Array<{
  slug: string;
  name: string;
  description: string;
  paradigm: "REATIVO" | "PROATIVO" | "PREDITIVO" | "AUTOATENDIMENTO";
  icon: string;
  color: string;
  order: number;
  spec: PresetSpec;
}> = [
  {
    slug: "closer-comercial-reativo",
    name: "Closer Comercial",
    description:
      "Fluxo reativo focado em conversão por proposta quando cliente entra em contato.",
    paradigm: "REATIVO",
    icon: "Target",
    color: "#FF6B6B",
    order: 0,
    spec: closerReativo,
  },
  {
    slug: "sdr-proativo",
    name: "SDR — Pré-vendas",
    description:
      "Pipeline proativo: novo lead → boas-vindas → form de qualificação → distribui.",
    paradigm: "PROATIVO",
    icon: "Send",
    color: "#4ECDC4",
    order: 0,
    spec: sdrProativo,
  },
  {
    slug: "astro-preditivo",
    name: "Astro — IA Preditiva",
    description:
      "IA conversa, classifica intenção e dispara automação adequada. Requer Astro/IA.",
    paradigm: "PREDITIVO",
    icon: "Sparkles",
    color: "#7A5FDF",
    order: 0,
    spec: astroPreditivo,
  },
  {
    slug: "self-service-autoatendimento",
    name: "Self-Service",
    description:
      "Cliente escolhe via form e é direcionado pra curso/onboarding. Sem humano.",
    paradigm: "AUTOATENDIMENTO",
    icon: "Bot",
    color: "#3DB88B",
    order: 0,
    spec: selfService,
  },
  {
    slug: "comercial-menu-interativo",
    name: "Atendimento Comercial — Menu + Agendamento + Follow-up",
    description:
      "Lead entra via menu de WhatsApp (Consultoria/Produtos/Interesse/Compra) → IA classifica a escolha (com fallback heurístico embutido se LLM falhar) → aplica tag e envia link de agenda → cadência 1/2/3/4/5/7/15/20/30/90 dias → tag final 'Desistiu 90' se ignorar. Testado e validado em produção.",
    paradigm: "REATIVO",
    icon: "MessageSquare",
    color: "#7A5FDF",
    order: 1,
    spec: comercialMenuInterativoSpec,
  },
];
