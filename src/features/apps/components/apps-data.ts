import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  Calendar,
  CircleCheck,
  ClipboardType,
  FolderOpen,
  GraduationCap,
  Hammer,
  Kanban,
  Landmark,
  LayoutTemplate,
  Link2,
  Map,
  MessageSquareText,
  MessagesSquare,
  Rocket,
  Send,
  Sparkles,
  Store,
  TrendingUp,
} from "lucide-react";
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
  SpaceStationIcon,
  StarFriendsIcon,
  BoostIcon,
} from "./app-icons";

export type AppStatus = "installed" | "development" | "available";

export interface AppDef {
  id: string;
  name: string;
  byline: string;
  status: AppStatus;
  icon: FC;
  /**
   * Ícone de traço, no mesmo estilo do menu lateral. O launcher usa este; os
   * cards da página /apps seguem com a arte colorida do `icon`.
   */
  lineIcon: LucideIcon;
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

// Catálogo em ordem alfabética pelo nome de exibição (`name`).
export const APPS: AppDef[] = [
  {
    id: "spacetime",
    name: "Agenda",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: SpaceTimeIcon,
    lineIcon: Calendar,
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
    id: "astro",
    name: "Astro",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: AstroIcon,
    lineIcon: Sparkles,
    shortDesc: "IA treinada para informar, preparar e quebrar objeções",
    fullDesc:
      "IA treinada para informar, preparar, quebrar objeções e sair de cena. Sem invadir a venda do humano. Sem parecer robô.",
    category: "Inteligência Artificial",
    integration: "—",
    action: "internal",
    href: "/astro",
    activeUsers: null,
    theme: "purple",
    // Sem `sidebarKey`: o ASTRO se abre pela engrenagem do próprio widget, que
    // está em todas as telas — um item de menu para isso era redundante.
  },
  {
    id: "astro-chat",
    name: "Astro Chat",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: AstroIcon,
    lineIcon: MessagesSquare,
    shortDesc: "O ASTRO atendendo os visitantes do site da sua empresa",
    fullDesc:
      "Instale o ASTRO no site da empresa com uma linha de código. Ele atende os visitantes com o conhecimento da sua empresa, capta nome e contato, e cada conversa vira lead no Chat. A equipe assume quando quiser.",
    category: "Inteligência Artificial",
    integration: "Qualquer site (snippet <script>)",
    action: "internal",
    href: "/astro-chat",
    activeUsers: null,
    theme: "purple",
    // Sem `sidebarKey`: ASTRO CHAT vive no painel de Apps, não no menu lateral.
  },
  {
    id: "trafego",
    name: "trafeGO",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: BoostIcon,
    lineIcon: TrendingUp,
    shortDesc: "Contrate tráfego pago e disparos sem passar por agência",
    fullDesc:
      "Self-service de tráfego pago e campanhas para quem quer investir sem contratar agência. O cliente escolhe o canal (Meta Ads ou WhatsApp API Oficial), o objetivo e o plano, paga, envia os criativos e a copy, e acompanha status e desempenho pelo painel. Nossa equipe cuida da execução. Metade do valor do plano vira verba de anúncio.",
    category: "Marketing",
    integration: "Meta Ads · WhatsApp API Oficial · Stripe",
    action: "internal",
    href: "/trafego/painel",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "trafego",
  },
  {
    id: "campanhas",
    name: "Campanhas",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: BoostIcon,
    lineIcon: Send,
    shortDesc: "Disparos em massa via WhatsApp API Oficial (Meta)",
    fullDesc:
      "Crie campanhas de disparo em massa pelo WhatsApp API Oficial (Meta Cloud). Selecione o número Oficial de origem, monte a audiência a partir dos leads do Tracking (com filtros) ou de um CSV/planilha, e acompanhe os destinatários. Envio por API oficial evita o banimento do número.",
    category: "Marketing",
    integration: "WhatsApp API Oficial (Meta) · Tracking",
    action: "internal",
    href: "/campanhas",
    activeUsers: null,
    theme: "purple",
    // Sem `sidebarKey`: Campanhas vive no painel de Apps, não no menu lateral.
  },
  {
    id: "comments",
    name: "Comments",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: CommentsIcon,
    lineIcon: AtSign,
    shortDesc: "Automatize respostas nos comentários do Instagram",
    fullDesc:
      "Automatize respostas nos comentários do Instagram e leve o cliente direto para o atendimento certo. Simples, rápido e sem complicação. Mais barato, mais inteligente e integrado ao resto da operação.",
    category: "Engajamento",
    integration: "Instagram",
    action: "internal",
    href: "/comments",
    activeUsers: null,
    theme: "purple",
    // Sem `sidebarKey`: COMMENTS vive no painel de Apps, não no menu lateral.
  },
  {
    id: "forge",
    name: "Forge",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: ForgeIcon,
    lineIcon: Hammer,
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
    id: "cosmic",
    name: "Formulários",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: CosmicIcon,
    lineIcon: ClipboardType,
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
    id: "linnker",
    name: "Linnker",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: LinnkerIcon,
    lineIcon: Link2,
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
    id: "nbox",
    name: "N-Box",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: NBoxIcon,
    lineIcon: FolderOpen,
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
    // NASA PAGES — builder de landing pages.
    // Visível em /apps. Sidebar oculto por default — user ativa
    // manualmente em "Personalizar menu" (entry em sidebar-items.ts
    // com defaultVisible: false).
    id: "nasa-pages",
    name: "Pages",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: LinnkerIcon, // ← TODO: substituir por NasaPagesIcon dedicado
    lineIcon: LayoutTemplate,
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
    id: "nasa-planner",
    name: "Planner",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: NasaPlannerIcon,
    lineIcon: Rocket,
    shortDesc:
      "Planeje, crie e execute estratégias de marketing com IA e Mapas Mentais",
    fullDesc:
      "Planejamento estratégico de marketing com IA e Mapas Mentais. Crie múltiplos planners com identidade de marca, Voz & Tom, SWOT e IA integrados. Gere posts para redes sociais, organize ações em mapas mentais (Gantt, diagrama, checklist), acompanhe no calendário e compartilhe com clientes via link. Conectado a todos os apps do ÓRBITA.",
    category: "Marketing",
    integration: "Demand · Tracking · N-Box · Spacetime · Nasachat · Insights",
    action: "internal",
    href: "/nasa-planner",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "nasa-planner",
  },
  {
    id: "nasa-route",
    name: "Route",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: NasaRouteIcon,
    lineIcon: GraduationCap,
    shortDesc: "Cursos, treinamentos e mentorias pagos com STARs",
    fullDesc:
      "Área de membros estilo Hotmart dentro do ÓRBITA. Crie e venda cursos gravados, treinamentos e mentorias usando STARs como moeda. Cada aula concluída concede Space Points para o aluno e o criador recebe 90% do valor em STARs (10% taxa da plataforma). Suporta vídeos do YouTube e Vimeo.",
    category: "Educação",
    integration: "STARs · Space Points · YouTube · Vimeo",
    action: "internal",
    href: "/nasa-route",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "nasa-route",
  },
  {
    id: "nasachat",
    name: "Nasachat",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: NasaChatIcon,
    lineIcon: MessageSquareText,
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
    id: "nerp",
    name: "Nerp",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: NerpIcon,
    lineIcon: Store,
    shortDesc: "ERP inteligente integrado ao comercial e ao atendimento",
    fullDesc:
      "Controle financeiro, loja online, frente de caixa e dados do negócio em um só lugar — tudo integrado ao restante do ecossistema ÓRBITA.",
    category: "Gestão",
    integration: "ERP",
    action: "internal",
    href: "/nerp",
    activeUsers: null,
    theme: "dark",
  },
  {
    id: "payment",
    name: "Financeiro",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: PaymentIcon,
    lineIcon: Landmark,
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
    id: "space-station",
    name: "Space Station",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: SpaceStationIcon,
    lineIcon: Map,
    shortDesc:
      "Mundo virtual 2D da sua marca — avatares, salas e presença em tempo real",
    fullDesc:
      "Crie um mundo virtual navegável para sua empresa: avatares, salas temáticas, presença em tempo real e módulos públicos (formulários, chat, agenda). Configure o mapa, o tema e quem pode entrar.",
    category: "Social",
    integration: "Pusher · LiveKit",
    action: "internal",
    href: "/space-station",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "space-station",
  },
  {
    id: "star-friends",
    name: "STAR FRIENDS",
    byline: "by ÓRBITA®",
    status: "available",
    icon: StarFriendsIcon,
    lineIcon: Sparkles,
    shortDesc: "Programa de fidelidade: cada compra vira star",
    fullDesc:
      "Cada compra paga no Catálogo online ou no Forge vira star para o cliente. Ele acumula e troca por produtos, descontos ou prêmios da sua lista — com histórico completo de quem lançou, quando e o quê.",
    category: "Vendas",
    integration: "Fidelidade",
    action: "internal",
    href: "/star-friends",
    activeUsers: null,
    theme: "purple",
    sidebarKey: "star-friends",
  },
  {
    id: "tracking",
    name: "Tracking",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: TrackingIcon,
    lineIcon: Kanban,
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
    id: "demand",
    name: "Workspace",
    byline: "by ÓRBITA®",
    status: "installed",
    icon: DemandIcon,
    lineIcon: CircleCheck,
    shortDesc:
      "Painel de controle com tarefas, equipe, clientes e treinamentos",
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
];
