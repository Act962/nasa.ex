import type { FC } from "react";
import {
  CommentsIcon,
  NerpIcon,
  CosmicIcon,
  NasaChatIcon,
  SpaceTimeIcon,
  PaymentIcon,
  ForgeIcon,
  LinnkerIcon,
  DemandIcon,
  AstroIcon,
  NBoxIcon,
  TrackingIcon,
  NasaPlannerIcon,
  NasaRouteIcon,
} from "./app-icons";

export type AppStatus = "installed" | "development" | "available";

export interface AppDef {
  id: string;
  name: string;
  byline: string;
  status: AppStatus;
  icon: FC;
  shortDesc: string;
  fullDesc: string;
  category: string;
  integration: string;
  action: "external" | "internal" | "modal";
  href?: string;
  activeUsers?: number | null;
  theme: "purple" | "dark" | "blue";
  sidebarKey?: string;
  /**
   * Quando `true`, o app NÃO aparece no AppsPage por default.
   * Usado pra apps em beta/internos que ainda não devem estar
   * visíveis pro user final mas existem no sistema.
   * Pra revelar: filtro "Mostrar ocultos" ou edição manual deste flag.
   */
  hidden?: boolean;
}

export const APPS: AppDef[] = [
  {
    id: "comments",
    name: "COMMENTS",
    byline: "by NASA®",
    status: "installed",
    icon: CommentsIcon,
    shortDesc: "Automatize respostas nos comentários do Instagram",
    fullDesc:
      "Automatize respostas nos comentários do Instagram e leve o cliente direto para o atendimento certo. Simples, rápido e sem complicação. Mais barato, mais inteligente e integrado ao resto da operação.",
    category: "Engajamento",
    integration: "Instagram",
    action: "internal",
    href: "/comments",
    activeUsers: null,
    theme: "purple",
  },
  {
    id: "nerp",
    name: "NERP",
    byline: "by NASA®",
    status: "installed",
    icon: NerpIcon,
    shortDesc: "ERP inteligente integrado ao comercial e ao atendimento",
    fullDesc:
      "Controle financeiro, loja online, frente de caixa e dados do negócio em um só lugar — tudo integrado ao restante do ecossistema NASA.",
    category: "Gestão",
    integration: "ERP",
    action: "internal",
    href: "/nerp",
    activeUsers: null,
    theme: "dark",
  },
  {
    id: "cosmic",
    name: "Formulários",
    byline: "by NASA®",
    status: "installed",
    icon: CosmicIcon,
    shortDesc: "Formulários inteligentes que viram dados estratégicos no CRM",
    fullDesc:
      "Sistema de formulários inteligentes. Cada resposta do cliente vira informação estratégica. O sistema entende o interesse e organiza automaticamente no CRM.",
    category: "CRM",
    integration: "—",
    action: "internal",
    href: "/form",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "cosmic",
  },
  {
    id: "nasachat",
    name: "NASACHAT",
    byline: "by NASA®",
    status: "installed",
    icon: NasaChatIcon,
    shortDesc: "WhatsApp organizado com histórico, CRM e IA integrados",
    fullDesc:
      "O WhatsApp organizado do jeito que deveria ser. Sistema de conversas interno offline. Atenda sem perder histórico, contexto ou oportunidade. Totalmente integrado ao CRM e ao Astro IA.",
    category: "Atendimento",
    integration: "WhatsApp",
    action: "internal",
    href: "/tracking-chat",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "nasachat",
  },
  {
    id: "spacetime",
    name: "Agenda",
    byline: "by NASA®",
    status: "installed",
    icon: SpaceTimeIcon,
    shortDesc: "Múltiplas agendas conectadas ao CRM e equipe",
    fullDesc:
      "Quem controla o tempo, controla a venda. Múltiplas agendas conectadas ao atendimento, CRM e equipe. Nada de cliente esquecido ou horário perdido.",
    category: "Agenda",
    integration: "—",
    action: "internal",
    href: "/agendas",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "spacetime",
  },
  {
    id: "forge",
    name: "FORGE",
    byline: "by NASA®",
    status: "installed",
    icon: ForgeIcon,
    shortDesc: "Propostas comerciais e contratos com assinatura digital",
    fullDesc:
      "Crie propostas profissionais, envie contratos digitais e feche negócios mais rápido. Tudo integrado ao CRM.",
    category: "Vendas",
    integration: "Multi-gateway",
    action: "internal",
    href: "/forge",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "forge",
  },
  {
    id: "payment",
    name: "PAYMENT",
    byline: "by NASA®",
    status: "installed",
    icon: PaymentIcon,
    shortDesc: "Gestão financeira: contas, fluxo de caixa, boletos e PIX",
    fullDesc:
      "Hub financeiro central da plataforma. Contas a receber e pagar, fluxo de caixa, DRE, boletos, PIX, notas fiscais e integrações com gateways de pagamento.",
    category: "Financeiro",
    integration: "Asaas · Stripe",
    action: "internal",
    href: "/payment",
    activeUsers: null,
    theme: "blue",
    sidebarKey: "payment",
  },
  {
    id: "linnker",
    name: "LINNKER",
    byline: "by NASA®",
    status: "installed",
    icon: LinnkerIcon,
    shortDesc: "Links personalizados que direcionam, organizam e viram dados",
    fullDesc:
      "Links personalizados que direcionam, organizam e viram dados. Crie páginas de bio estilo Linktree com cards clicáveis, QR codes que capturam leads automaticamente no Tracking, e estatísticas de acesso em tempo real.",
    category: "Marketing",
    integration: "Tracking · Formulários · Agenda · Chat",
    action: "internal",
    href: "/linnker",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "linnker",
  },
  {
    // NASA PAGES — builder de landing pages.
    // Visível em /apps. Sidebar oculto por default — user ativa
    // manualmente em "Personalizar menu" (entry em sidebar-items.ts
    // com defaultVisible: false).
    id: "nasa-pages",
    name: "NASA PAGES",
    byline: "by NASA®",
    status: "installed",
    icon: LinnkerIcon, // ← TODO: substituir por NasaPagesIcon dedicado
    shortDesc: "Construa landing pages completas com templates prontos",
    fullDesc:
      "Builder visual de landing pages com 26 tipos de bloco prontos: hero, pricing, FAQ, testimonials, marquee, navbar, footer e mais. Aplica templates inteiros num clique, edita inline e publica em domínio próprio. Dados ao vivo dos planos, cursos e leaderboard do app integrados.",
    category: "Marketing",
    integration: "Templates · Dados ao vivo · Domínio próprio",
    action: "internal",
    href: "/pages",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "nasa-pages",
  },
  {
    id: "demand",
    name: "Workspace",
    byline: "by NASA®",
    status: "installed",
    icon: DemandIcon,
    shortDesc: "Painel de controle com tarefas, equipe, clientes e treinamentos",
    fullDesc:
      "O painel de controle da sua operação. Organize tarefas, equipe, clientes e treinamentos em um único lugar. Kanban, listas, automações e mensagens integradas.",
    category: "Gestão",
    integration: "—",
    action: "internal",
    href: "/workspaces",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "workspaces",
  },
  {
    id: "astro",
    name: "ASTRO",
    byline: "by NASA®",
    status: "installed",
    icon: AstroIcon,
    shortDesc: "IA treinada para informar, preparar e quebrar objeções",
    fullDesc:
      "IA treinada para informar, preparar, quebrar objeções e sair de cena. Sem invadir a venda do humano. Sem parecer robô.",
    category: "Inteligência Artificial",
    integration: "—",
    action: "modal",
    activeUsers: null,
    theme: "purple",
  },
  {
    id: "nbox",
    name: "N-BOX",
    byline: "by NASA®",
    status: "installed",
    icon: NBoxIcon,
    shortDesc: "Gestão de documentos, arquivos e links da organização",
    fullDesc:
      "Centralize todos os arquivos, documentos, imagens e links da sua organização em um único lugar. Organize por pastas, busque rapidamente e monitore o uso de armazenamento por plano.",
    category: "Documentos",
    integration: "S3",
    action: "internal",
    href: "/nbox",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "nbox",
  },
  {
    id: "nasa-planner",
    name: "NASA PLANNER",
    byline: "by NASA®",
    status: "installed",
    icon: NasaPlannerIcon,
    shortDesc: "Planeje, crie e execute estratégias de marketing com IA e Mapas Mentais",
    fullDesc:
      "Planejamento estratégico de marketing com IA e Mapas Mentais. Crie múltiplos planners com identidade de marca, Voz & Tom, SWOT e IA integrados. Gere posts para redes sociais, organize ações em mapas mentais (Gantt, diagrama, checklist), acompanhe no calendário e compartilhe com clientes via link. Conectado a todos os apps do NASA.",
    category: "Marketing",
    integration: "Demand · Tracking · N-Box · Spacetime · Nasachat · Insights",
    action: "internal",
    href: "/nasa-planner",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "nasa-planner",
  },
  {
    id: "tracking",
    name: "TRACKING",
    byline: "by NASA®",
    status: "installed",
    icon: TrackingIcon,
    shortDesc: "Rota completa do cliente do primeiro contato à venda",
    fullDesc:
      "Organize atendimentos, vendas, projetos e setores em múltiplos CRMs conectados. Rastreie de onde o cliente veio, o que quer e quando agir.",
    category: "CRM",
    integration: "Multi-CRM",
    action: "internal",
    href: "/tracking",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "tracking",
  },
  {
    id: "nasa-route",
    name: "NASA ROUTE",
    byline: "by NASA®",
    status: "installed",
    icon: NasaRouteIcon,
    shortDesc: "Cursos, treinamentos e mentorias pagos com STARs",
    fullDesc:
      "Área de membros estilo Hotmart dentro do NASA. Crie e venda cursos gravados, treinamentos e mentorias usando STARs como moeda. Cada aula concluída concede Space Points para o aluno e o criador recebe 90% do valor em STARs (10% taxa da plataforma). Suporta vídeos do YouTube e Vimeo.",
    category: "Educação",
    integration: "STARs · Space Points · YouTube · Vimeo",
    action: "internal",
    href: "/nasa-route",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "nasa-route",
  },
];
