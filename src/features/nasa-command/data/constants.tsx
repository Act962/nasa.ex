import { IntegrationPlatform } from "@/generated/prisma/enums";
import { Bot } from "lucide-react";
import React from "react";
import { ExampleCategory, ModelOption } from "../types";

export const RECENT_KEY = "nasa-explorer:recent-commands";
export const RECENT_MAX = 8;

/**
 * Biblioteca de exemplos do Explorer — agrupada por área do NASA.
 * Cada categoria espelha um conjunto de tools que o Astro tem no
 * analytics-agent + task-agent + automation-agent + closer.
 *
 * Sempre que abrir uma tool nova, adicione 2-4 exemplos aqui — é o
 * principal canal de descoberta pro usuário.
 */
export const exampleCategories: ExampleCategory[] = [
  // ── Tracking & Pipeline (CRM) ─────────────────────────────────────────────
  {
    emoji: "🎯",
    label: "Tracking & Pipeline",
    examples: [
      "Quantos leads ativos tenho em cada tracking?",
      "Quantos leads estão em cada etapa do funil?",
      "Qual a taxa de conversão dos últimos 30 dias?",
      "Quanto tenho em pipeline no tracking Vendas?",
      "Mostra o crescimento mensal de leads dos últimos 6 meses",
      "Quais são as top 5 tags dos meus leads?",
      "Quantas automações eu tenho cadastradas e quantas estão ativas?",
      "Crie um lead chamado João Pereira no tracking Vendas",
      "Mova a Maria Costa para o status Proposta Enviada",
    ],
  },
  // ── Chat & Atendimento ────────────────────────────────────────────────────
  {
    emoji: "💬",
    label: "Chat & Atendimento",
    examples: [
      "Quantas conversas ativas eu tenho?",
      "Quantas mensagens enviei vs recebi essa semana?",
      "Qual o tempo médio de primeira resposta?",
      "Quantos lembretes foram disparados nos últimos 7 dias?",
      "Em quais etapas estão os leads que estão no chat?",
      "Mostra as conversas com tag 'urgente' no tracking Vendas",
    ],
  },
  // ── Forge (Propostas) ─────────────────────────────────────────────────────
  {
    emoji: "🔥",
    label: "Forge — Propostas",
    examples: [
      "Quantas propostas estão pagas esse mês?",
      "Qual a receita fechada nos últimos 30 dias?",
      "Quanto tenho em valores em aberto?",
      "Qual minha receita perdida (canceladas + expiradas)?",
      "Qual o ticket médio e o desconto médio das propostas?",
      "Quanto tempo em média leva uma proposta pra ser paga?",
      "Crie uma proposta para Maria do Amparo com validade hoje",
      "Liste todas as propostas abertas",
    ],
  },
  // ── Agendamentos (Spacetime) ──────────────────────────────────────────────
  {
    emoji: "📅",
    label: "Agendamentos",
    examples: [
      "Quantos agendamentos pendentes vs confirmados eu tenho?",
      "Qual a taxa de no-show essa semana?",
      "Qual minha taxa de comparecimento no mês?",
      "Quais são meus compromissos de hoje?",
      "Agende uma reunião com Carlos Lima para sexta às 10h",
      "Marque um follow-up com João Silva pra semana que vem 09h",
    ],
  },
  // ── Workspace (Actions / Tarefas) ─────────────────────────────────────────
  {
    emoji: "📋",
    label: "Workspace & Tarefas",
    examples: [
      "Quantas tarefas atrasadas eu tenho?",
      "Quantas actions urgentes estão abertas?",
      "Quantas tarefas eu concluí esse mês?",
      "Lista as tarefas do workspace Marketing com prioridade alta",
      "Crie uma tarefa 'Ligar pro Wey' pra amanhã 10h",
      "Mostra as actions do projeto Cliente X",
    ],
  },
  // ── Formulários ───────────────────────────────────────────────────────────
  {
    emoji: "📝",
    label: "Formulários",
    examples: [
      "Quantos formulários tenho publicados?",
      "Total de submissões vs visualizações no mês",
      "Quantas submissões geraram leads?",
      "Qual a taxa de abandono dos formulários?",
      "Quais os 5 formulários com mais respostas?",
    ],
  },
  // ── NASA Route (cursos) ───────────────────────────────────────────────────
  {
    emoji: "🎓",
    label: "NASA Route — Cursos",
    examples: [
      "Quantos cursos publicados eu tenho?",
      "Quantos alunos no total e quantos concluíram?",
      "Quanto faturei em Stars com cursos esse mês?",
      "Quais os top 5 cursos por matrículas?",
      "Quantos certificados foram emitidos?",
    ],
  },
  // ── Linnker (bio-link) ────────────────────────────────────────────────────
  {
    emoji: "🔗",
    label: "Linnker — Bio Link",
    examples: [
      "Quantos acessos minhas páginas Linnker receberam?",
      "Quantos scans capturaram lead esse mês?",
      "Qual a taxa de captura de lead do Linnker?",
      "Quantos cliques nos links das minhas páginas?",
      "Quais são as top páginas Linnker?",
    ],
  },
  // ── NBox (storage) ────────────────────────────────────────────────────────
  {
    emoji: "📦",
    label: "NBox — Storage",
    examples: [
      "Quanto espaço estou usando no NBox?",
      "Quantos itens públicos eu tenho compartilhados?",
      "Quantos arquivos vs imagens eu armazenei?",
      "Quantos itens o usuário X criou esse mês?",
    ],
  },
  // ── Financeiro ────────────────────────────────────────────────────────────
  {
    emoji: "💰",
    label: "Financeiro",
    examples: [
      "Qual minha receita recebida esse mês?",
      "Quanto tenho a receber pendente?",
      "Quanto tenho de contas vencidas?",
      "Qual meu saldo (receita - despesa) no período?",
      "Qual minha taxa de inadimplência?",
      "Qual o ticket médio das contas pagas?",
      "Quanto recebi por categoria esse mês?",
    ],
  },
  // ── Insights ──────────────────────────────────────────────────────────────
  {
    emoji: "📊",
    label: "Insights — Relatórios",
    examples: [
      "Quantos relatórios de Insights minha empresa tem salvos?",
      "Quais os últimos relatórios criados?",
      "Quem criou o relatório de janeiro?",
    ],
  },
  // ── Integrações ───────────────────────────────────────────────────────────
  {
    emoji: "🔌",
    label: "Integrações",
    examples: [
      "Quais integrações estão conectadas?",
      "Tem alguma integração com erro?",
      "Quando foi a última sincronização do Meta Ads?",
      "Como instalo a integração do WhatsApp?",
    ],
  },
  // ── Space Help ────────────────────────────────────────────────────────────
  {
    emoji: "🚀",
    label: "Space Help — Trilhas",
    examples: [
      "Qual trilha do Space Help me ensina sobre Tracking?",
      "Quais trilhas eu já comecei?",
      "Quantas trilhas eu já completei?",
      "Tem trilha sobre Forge ou Propostas?",
      "Quais badges eu já conquistei?",
    ],
  },
  // ── Automações & Alertas ──────────────────────────────────────────────────
  {
    emoji: "⚡",
    label: "Automações & Alertas",
    examples: [
      "Me avise quando um lead ficar 2 dias parado",
      "Crie uma automação: quando lead vai pra 'Ganhou', alerta warning pro responsável",
      "Quero alerta crítico se WhatsApp cair",
      "Liste minhas automações ativas",
    ],
  },
  // ── Atividade & Stars ─────────────────────────────────────────────────────
  {
    emoji: "✨",
    label: "Atividade & Stars",
    examples: [
      "Quem foi o mais ativo da equipe essa semana?",
      "Quais apps consumiram mais Stars no mês?",
      "Qual meu saldo de Stars atual?",
      "Quanto tempo ativo a equipe acumulou?",
      "Top 5 usuários por ações executadas",
    ],
  },
];

/**
 * Exemplos rotativos exibidos no placeholder do composer e no welcome.
 * Mantém pelo menos um exemplo de cada área principal pra mostrar a
 * variedade do Astro logo na primeira impressão.
 */
export const rotatingExamples = [
  "Quantos leads ativos tenho em cada tracking?",
  "Qual a taxa de conversão dos últimos 30 dias?",
  "Quantas conversas ativas eu tenho?",
  "Qual a receita fechada esse mês?",
  "Quanto tenho em valores em aberto no Forge?",
  "Qual a taxa de no-show da agenda?",
  "Quantas tarefas atrasadas eu tenho?",
  "Quanto espaço estou usando no NBox?",
  "Qual minha receita recebida esse mês?",
  "Quantos acessos minhas páginas Linnker receberam?",
  "Quantos cursos publicados eu tenho?",
  "Quais integrações estão conectadas?",
  "Me avise quando um lead ficar 2 dias parado",
  "Crie um lead chamado João Pereira no tracking Vendas",
  "Agende uma reunião com Carlos Lima para sexta às 10h",
  "Qual trilha do Space Help me ensina sobre Tracking?",
];

export const PROVIDER_MODELS: Record<string, ModelOption[]> = {
  [IntegrationPlatform.ANTHROPIC]: [
    {
      id: "claude-sonnet-4-5",
      label: "Claude Sonnet",
      sublabel: "4.5",
      icon: <Bot className="w-4 h-4 text-[#D97757]" />,
      provider: "Anthropic",
    },
    {
      id: "claude-3-5-haiku-latest",
      label: "Claude Haiku",
      sublabel: "3.5",
      icon: <Bot className="w-4 h-4 text-[#D97757]/70" />,
      provider: "Anthropic",
    },
  ],
  [IntegrationPlatform.OPENAI]: [
    {
      id: "gpt-4o",
      label: "GPT-4o",
      sublabel: "OpenAI",
      icon: (
        <svg
          className="w-4 h-4 text-emerald-400"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
        </svg>
      ),
      provider: "OpenAI",
    },
    {
      id: "gpt-4o-mini",
      label: "GPT-4o mini",
      sublabel: "OpenAI",
      icon: (
        <svg
          className="w-4 h-4 text-emerald-400/70"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
        </svg>
      ),
      provider: "OpenAI",
    },
  ],
  [IntegrationPlatform.GEMINI]: [
    {
      id: "gemini-2.5-flash-preview-04-17",
      label: "Gemini 2.5 Flash",
      sublabel: "Google",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="gem-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="50%" stopColor="#EA4335" />
              <stop offset="100%" stopColor="#FBBC04" />
            </linearGradient>
          </defs>
          <path
            d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3l2 5h-4l2-5zm0 12l-2-5h4l-2 5zm-5-5l5-2v4l-5-2zm10 0l-5 2v-4l5 2z"
            fill="url(#gem-g)"
          />
        </svg>
      ),
      provider: "Google",
    },
    {
      id: "gemini-1.5-pro",
      label: "Gemini 1.5 Pro",
      sublabel: "Google",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="gem-g2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="100%" stopColor="#34A853" />
            </linearGradient>
          </defs>
          <path
            d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3l2 5h-4l2-5zm0 12l-2-5h4l-2 5zm-5-5l5-2v4l-5-2zm10 0l-5 2v-4l5 2z"
            fill="url(#gem-g2)"
          />
        </svg>
      ),
      provider: "Google",
    },
  ],
};

export const AI_PLATFORMS = [
  IntegrationPlatform.ANTHROPIC,
  IntegrationPlatform.OPENAI,
  IntegrationPlatform.GEMINI,
] as const;

export const PROVIDER_LABELS: Record<string, string> = {
  [IntegrationPlatform.ANTHROPIC]: "Anthropic",
  [IntegrationPlatform.OPENAI]: "OpenAI",
  [IntegrationPlatform.GEMINI]: "Google",
};

export const STARS = Array.from({ length: 160 }, (_, i) => ({
  x: (((i * 1_234_567 + 89) % 9_973) / 9_973) * 100,
  y: (((i * 7_654_321 + 31) % 9_973) / 9_973) * 100,
  r: i % 7 === 0 ? 1.4 : i % 3 === 0 ? 0.9 : 0.5,
  o: 0.12 + (i % 9) * 0.09,
}));
