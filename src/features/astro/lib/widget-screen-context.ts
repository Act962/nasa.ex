import {
  AlarmClock,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FileText,
  FolderOpen,
  Globe,
  Landmark,
  Link2,
  ListChecks,
  Megaphone,
  MessageSquareText,
  PlugZap,
  Send,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { AstroBriefingApp } from "@/features/astro/lib/astro-briefing-apps";

/** O que o painel do Astro diz e sugere em cada App: o subtítulo do topo, a pergunta grande (ou o resumo da semana) e os atalhos. */

export interface WidgetSuggestion {
  label: string;
  icon: LucideIcon;
}

export interface WidgetScreenContext {
  /** Subtítulo no topo do painel ("No Tracking"). */
  screenLabel: string;
  heading: string;
  suggestions: WidgetSuggestion[];
  hint?: string;
  /** App com resumo da semana: o Astro abre o painel já "mandando" a mensagem (spec 0056). */
  briefingApp?: AstroBriefingApp;
}

interface ScreenContextEntry extends WidgetScreenContext {
  pathPrefixes: string[];
}

// Ordem importa: prefixos mais específicos antes (`/tracking-chat` antes de `/tracking`).
const SCREEN_CONTEXTS: ScreenContextEntry[] = [
  {
    pathPrefixes: ["/tracking-chat"],
    screenLabel: "No Chat",
    briefingApp: "chat",
    heading: "Quer ajuda com as conversas?",
    suggestions: [
      { label: "Quais conversas estão sem resposta?", icon: MessageSquareText },
      { label: "Resuma a conversa mais recente", icon: Sparkles },
      { label: "Quais leads estão mais quentes hoje?", icon: Target },
    ],
  },
  {
    pathPrefixes: ["/tracking"],
    screenLabel: "No Tracking",
    heading: "O que você quer saber dos seus leads?",
    briefingApp: "tracking",
    suggestions: [
      { label: "Quantos leads entraram esta semana?", icon: Users },
      { label: "Quais leads estão parados há mais tempo?", icon: AlarmClock },
      { label: "Quais leads estão mais quentes hoje?", icon: Target },
      { label: "Crie um lead novo", icon: UserPlus },
    ],
  },
  {
    pathPrefixes: ["/agendas"],
    screenLabel: "Na Agenda",
    briefingApp: "agenda",
    heading: "O que tem na sua agenda?",
    suggestions: [
      { label: "Quais compromissos tenho hoje?", icon: CalendarDays },
      { label: "O que tenho marcado esta semana?", icon: CalendarClock },
      { label: "Quais horários estão livres amanhã?", icon: ListChecks },
    ],
  },
  {
    pathPrefixes: ["/workspaces"],
    screenLabel: "No Workspace",
    briefingApp: "workspace",
    heading: "Como posso ajudar no projeto?",
    suggestions: [
      { label: "O que tenho pra fazer hoje?", icon: ListChecks },
      { label: "Quais tarefas estão atrasadas?", icon: AlarmClock },
      { label: "Crie uma tarefa nova", icon: ClipboardList },
    ],
  },
  {
    pathPrefixes: ["/campanhas"],
    screenLabel: "Nas Campanhas",
    briefingApp: "campanhas",
    heading: "Vamos falar das suas campanhas?",
    suggestions: [
      { label: "Como foi a última campanha enviada?", icon: BarChart3 },
      { label: "Quantas mensagens ainda posso enviar?", icon: Send },
      { label: "Me ajude a escrever uma campanha", icon: Megaphone },
    ],
  },
  {
    pathPrefixes: ["/contatos"],
    screenLabel: "Nos Contatos",
    briefingApp: "contacts",
    heading: "O que você quer saber dos contatos?",
    suggestions: [
      { label: "Quantos contatos novos entraram este mês?", icon: Users },
      { label: "Quem não recebe contato há mais de 30 dias?", icon: AlarmClock },
      { label: "Adicione um contato novo", icon: UserPlus },
    ],
  },
  {
    pathPrefixes: ["/form", "/formulario"],
    screenLabel: "Nos Formulários",
    heading: "Como posso ajudar com os formulários?",
    briefingApp: "forms",
    suggestions: [
      { label: "Quantas respostas chegaram esta semana?", icon: ClipboardList },
      { label: "Qual formulário trouxe mais leads?", icon: TrendingUp },
      { label: "Quais formulários estão sem respostas?", icon: AlarmClock },
      { label: "Me ajude a montar um formulário", icon: Sparkles },
    ],
  },
  {
    pathPrefixes: ["/forge"],
    screenLabel: "No Forge",
    briefingApp: "forge",
    heading: "O que você quer saber das propostas?",
    suggestions: [
      { label: "Quais propostas estão esperando assinatura?", icon: FileSignature },
      { label: "Quanto vendi em propostas este mês?", icon: TrendingUp },
      { label: "Crie uma proposta nova", icon: FileText },
    ],
  },
  {
    pathPrefixes: ["/pages"],
    screenLabel: "No Pages",
    briefingApp: "pages",
    heading: "Como posso ajudar com suas páginas?",
    suggestions: [
      { label: "Quantas visitas minhas páginas tiveram esta semana?", icon: BarChart3 },
      { label: "Qual página está convertendo melhor?", icon: TrendingUp },
      { label: "Me ajude a escrever o texto de uma página", icon: Globe },
    ],
  },
  {
    pathPrefixes: ["/linnker"],
    screenLabel: "No Linnker",
    briefingApp: "linnker",
    heading: "Como posso ajudar no seu Linnker?",
    suggestions: [
      { label: "Quantos cliques meus links tiveram esta semana?", icon: BarChart3 },
      { label: "Qual link é o mais clicado?", icon: Link2 },
      { label: "Sugira uma bio para o meu Linnker", icon: Sparkles },
    ],
  },
  {
    pathPrefixes: ["/nbox"],
    screenLabel: "No N-Box",
    briefingApp: "nbox",
    heading: "O que você procura nos arquivos?",
    suggestions: [
      { label: "Quais arquivos enviei esta semana?", icon: FolderOpen },
      { label: "Encontre um contrato", icon: FileText },
      { label: "Como organizar minhas pastas?", icon: Sparkles },
    ],
  },
  {
    pathPrefixes: ["/insights"],
    screenLabel: "Nos Insights",
    briefingApp: "insights",
    heading: "O que os números estão dizendo?",
    suggestions: [
      { label: "Como foram as vendas este mês?", icon: TrendingUp },
      { label: "Qual canal trouxe mais leads?", icon: BarChart3 },
      { label: "Compare este mês com o anterior", icon: CalendarClock },
    ],
  },
  {
    pathPrefixes: ["/nasa-planner", "/nasa-post"],
    screenLabel: "No Planner",
    briefingApp: "planner",
    heading: "Vamos planejar o seu conteúdo?",
    suggestions: [
      { label: "O que está programado para esta semana?", icon: CalendarDays },
      { label: "Sugira ideias de posts para o mês", icon: Sparkles },
      { label: "Quais posts estão atrasados?", icon: AlarmClock },
    ],
  },
  {
    pathPrefixes: ["/nasa-route"],
    screenLabel: "No Route",
    briefingApp: "route",
    heading: "Como posso ajudar com seus cursos?",
    suggestions: [
      { label: "Quantos alunos entraram este mês?", icon: Users },
      { label: "Quanto vendi em cursos este mês?", icon: TrendingUp },
      { label: "Me ajude a montar as aulas de um curso", icon: BookOpen },
    ],
  },
  {
    pathPrefixes: ["/trafego"],
    screenLabel: "No trafeGO",
    briefingApp: "trafego",
    heading: "Como estão os seus anúncios?",
    suggestions: [
      { label: "Quanto gastei em anúncios esta semana?", icon: Wallet },
      { label: "Qual anúncio trouxe mais leads?", icon: Target },
      { label: "Como melhorar meus anúncios?", icon: Sparkles },
    ],
  },
  {
    pathPrefixes: ["/integrations"],
    screenLabel: "Nos Satélites",
    briefingApp: "integrations",
    heading: "O que você quer conectar?",
    suggestions: [
      { label: "Quais satélites estão conectados?", icon: PlugZap },
      { label: "Como conectar o WhatsApp?", icon: MessageSquareText },
      { label: "Como conectar minha IA?", icon: Sparkles },
    ],
  },
  {
    pathPrefixes: ["/star-friends"],
    screenLabel: "No STAR FRIENDS",
    heading: "Como está o seu programa de fidelidade?",
    briefingApp: "starFriends",
    suggestions: [
      { label: "Quais clientes têm mais Stars?", icon: Star },
      { label: "Quais resgates estão esperando aprovação?", icon: BadgeCheck },
      { label: "Como atrair mais clientes para o programa?", icon: Sparkles },
    ],
  },
  {
    pathPrefixes: ["/space-station"],
    screenLabel: "Na Space Station",
    heading: "Como posso ajudar por aqui?",
    briefingApp: "spaceStation",
    suggestions: [
      { label: "Quantas Stars eu tenho?", icon: Star },
      { label: "Como ganhar mais Stars?", icon: Sparkles },
      { label: "Quem está online agora?", icon: Users },
    ],
  },
  {
    pathPrefixes: ["/space-help"],
    screenLabel: "No Space Help",
    briefingApp: "spaceHelp",
    heading: "O que você quer aprender?",
    suggestions: [
      { label: "Por onde eu começo no ÓRBITA?", icon: BookOpen },
      { label: "Me mostre como criar um tracking", icon: Target },
      { label: "Como conectar o WhatsApp?", icon: MessageSquareText },
    ],
  },
];

const FINANCE_CONTEXT: WidgetScreenContext = {
  screenLabel: "No financeiro",
  briefingApp: "finance",
  heading: "Como está o seu dinheiro?",
  suggestions: [
    { label: "Quanto tenho a pagar esta semana?", icon: CalendarClock },
    { label: "Como está meu fluxo de caixa?", icon: TrendingUp },
    { label: "O que está vencido?", icon: AlarmClock },
  ],
  hint: "Anexe um boleto ou uma nota fiscal pelo clipe e peça pra lançar. Nada é gravado sem a sua confirmação.",
};

const ACCOUNTING_CONTEXT: WidgetScreenContext = {
  screenLabel: "Na aba Contábil",
  briefingApp: "accounting",
  heading: "O que você quer saber dos impostos?",
  suggestions: [
    { label: "Quanto vou pagar de DAS este mês?", icon: Landmark },
    { label: "Quais impostos e declarações vencem nos próximos 30 dias?", icon: CalendarClock },
    { label: "Minha empresa está regular?", icon: BadgeCheck },
  ],
};

const GENERAL_CONTEXT: WidgetScreenContext = {
  screenLabel: "Seu copiloto no ÓRBITA",
  heading: "O que você quer saber?",
  suggestions: [
    { label: "O que tenho pra fazer hoje?", icon: ListChecks },
    { label: "Quantos leads entraram esta semana?", icon: Users },
    { label: "Como está o financeiro do mês?", icon: Wallet },
  ],
};

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveWidgetScreenContext(pathname: string, paymentTab: string | null): WidgetScreenContext {
  if (matchesPrefix(pathname, "/payment")) {
    return paymentTab === "accounting" ? ACCOUNTING_CONTEXT : FINANCE_CONTEXT;
  }
  const entry = SCREEN_CONTEXTS.find((context) =>
    context.pathPrefixes.some((prefix) => matchesPrefix(pathname, prefix)),
  );
  return entry ?? GENERAL_CONTEXT;
}
