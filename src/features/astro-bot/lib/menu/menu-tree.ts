import "server-only";
import type { AppKey, OrgAction } from "@/features/permissions/lib/catalog";

// Árvore do menu do Astro no WhatsApp (spec 0079). É dado, não fluxo: cada folha guarda a frase
// que a pessoa teria escrito, e essa frase segue o mesmo caminho de um pedido digitado (RF-7).
// Lista da Meta aceita 10 linhas: com "Voltar ao início", cabem 9 Apps. Só entra App que o Astro já opera.

export const MENU_ID_PREFIX = "menu:";
export const ANSWER_ID_PREFIX = "ans:";
export const MENU_ROOT_ID = `${MENU_ID_PREFIX}root`;
export const MENU_APPS_ID = `${MENU_ID_PREFIX}apps`;
export const MENU_END_ID = `${MENU_ID_PREFIX}end`;
export const SEARCH_ANSWER_ID = `${ANSWER_ID_PREFIX}buscar`;

export type MenuItem = {
  id: string;
  title: string;
  description: string;
  /** Sem permissão, o item não aparece. */
  permission: { appKey: AppKey; action: OrgAction };
} & (
  | { prompt: string }
  /** Ação que precisa de um dado que só a pessoa sabe escrever (nome, telefone). */
  | { hint: string }
);

export interface MenuApp {
  id: string;
  title: string;
  /** Rótulo do botão da saudação: botão da Meta aceita 20 caracteres. */
  shortTitle: string;
  description: string;
  appKey: AppKey;
  /** Só aparece quando a empresa ligou o Astro Financeiro pelo WhatsApp (spec 0019). */
  requiresFinance?: boolean;
  question: string;
  items: MenuItem[];
}

export const MENU_APPS: MenuApp[] = [
  {
    id: "agenda",
    title: "Agenda",
    shortTitle: "Agenda",
    description: "Compromissos e horários",
    appKey: "spacetime",
    question: "O que você quer fazer na Agenda?",
    items: [
      { id: "agenda.ver", title: "Ver compromissos", description: "Hoje e próximos dias", permission: { appKey: "spacetime", action: "view" }, prompt: "quais compromissos tenho essa semana?" },
      { id: "agenda.marcar", title: "Marcar", description: "Novo compromisso", permission: { appKey: "spacetime", action: "create" }, prompt: "quero marcar um compromisso" },
      { id: "agenda.remarcar", title: "Remarcar", description: "Mudar o horário", permission: { appKey: "spacetime", action: "edit" }, prompt: "quero remarcar um compromisso" },
      { id: "agenda.desmarcar", title: "Desmarcar", description: "Cancelar um compromisso", permission: { appKey: "spacetime", action: "delete" }, prompt: "quero desmarcar um compromisso" },
    ],
  },
  {
    id: "crm",
    title: "CRM (Tracking)",
    shortTitle: "CRM",
    description: "Leads e funis",
    appKey: "tracking",
    question: "O que você quer fazer no CRM?",
    items: [
      { id: "crm.buscar", title: "Buscar lead", description: "Pelo nome ou telefone", permission: { appKey: "tracking", action: "view" }, hint: 'Escreva o nome ou o telefone do lead.\nEx.: "me mostra o lead Maria Clara".' },
      { id: "crm.criar", title: "Criar lead", description: "Novo contato no funil", permission: { appKey: "tracking", action: "create" }, prompt: "quero criar um lead" },
      { id: "crm.mover", title: "Mover de etapa", description: "Levar o lead a outra coluna", permission: { appKey: "tracking", action: "edit" }, prompt: "quero mover um lead de etapa" },
      { id: "crm.atualizar", title: "Atualizar lead", description: "Telefone, valor, temperatura", permission: { appKey: "tracking", action: "edit" }, prompt: "quero atualizar um lead" },
    ],
  },
  {
    id: "demandas",
    title: "Demandas (Workspace)",
    shortTitle: "Demandas",
    description: "Tarefas da equipe",
    appKey: "workspace",
    question: "O que você quer fazer nas Demandas?",
    items: [
      { id: "demandas.minhas", title: "Minhas tarefas", description: "Em aberto e atrasadas", permission: { appKey: "workspace", action: "view" }, prompt: "quais são as minhas tarefas pendentes?" },
      { id: "demandas.criar", title: "Criar demanda", description: "Nova tarefa", permission: { appKey: "workspace", action: "create" }, prompt: "quero criar uma demanda" },
      { id: "demandas.editar", title: "Editar demanda", description: "Título, prazo, responsável", permission: { appKey: "workspace", action: "edit" }, prompt: "quero editar uma demanda" },
      { id: "demandas.concluir", title: "Concluir demanda", description: "Marcar como feita", permission: { appKey: "workspace", action: "edit" }, prompt: "quero concluir uma demanda" },
    ],
  },
  {
    id: "chat",
    title: "Chat",
    shortTitle: "Chat",
    description: "Conversas do WhatsApp",
    appKey: "chat",
    question: "O que você quer fazer no Chat?",
    items: [
      { id: "chat.nao-lidas", title: "Não lidas", description: "Conversas sem ler", permission: { appKey: "chat", action: "view" }, prompt: "quantas conversas não lidas?" },
      { id: "chat.aguardando", title: "Aguardando resposta", description: "Quem está esperando", permission: { appKey: "chat", action: "view" }, prompt: "quais conversas estão aguardando resposta?" },
      { id: "chat.enviar", title: "Enviar mensagem", description: "Para um lead", permission: { appKey: "chat", action: "create" }, prompt: "quero enviar uma mensagem" },
      { id: "chat.abrir", title: "Abrir conversa", description: "Com um número novo", permission: { appKey: "chat", action: "create" }, prompt: "quero abrir uma conversa" },
    ],
  },
  {
    id: "insights",
    title: "Insights",
    shortTitle: "Insights",
    description: "Números de vendas",
    appKey: "insights",
    question: "O que você quer ver nos Insights?",
    items: [
      { id: "insights.funil", title: "Funil", description: "Etapas e onde trava", permission: { appKey: "insights", action: "view" }, prompt: "como está o desempenho do funil?" },
      { id: "insights.ganhos", title: "Ganhos e perdas", description: "Conversão do período", permission: { appKey: "insights", action: "view" }, prompt: "quais os ganhos e perdas?" },
      { id: "insights.vendas", title: "Vendas do mês", description: "Quanto foi vendido", permission: { appKey: "insights", action: "view" }, prompt: "quanto vendi neste mês?" },
      { id: "insights.canais", title: "Canais", description: "De onde vêm os leads", permission: { appKey: "insights", action: "view" }, prompt: "de onde vêm os leads?" },
    ],
  },
  {
    id: "propostas",
    title: "Propostas (Forge)",
    shortTitle: "Propostas",
    description: "Orçamentos e contratos",
    appKey: "forge",
    question: "O que você quer fazer nas Propostas?",
    items: [
      { id: "propostas.ver", title: "Ver propostas", description: "Por situação", permission: { appKey: "forge", action: "view" }, prompt: "quais propostas eu tenho?" },
      { id: "propostas.aberto", title: "Valor em aberto", description: "Enviadas e não fechadas", permission: { appKey: "forge", action: "view" }, prompt: "qual o valor total das propostas em aberto?" },
      { id: "propostas.criar", title: "Criar proposta", description: "Novo orçamento", permission: { appKey: "forge", action: "create" }, prompt: "quero criar uma proposta" },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    shortTitle: "Financeiro",
    description: "Contas a pagar e receber",
    appKey: "financeiro",
    requiresFinance: true,
    question: "O que você quer fazer no Financeiro?",
    items: [
      { id: "financeiro.resumo", title: "Resumo", description: "A pagar, a receber, vencidas", permission: { appKey: "financeiro", action: "view" }, prompt: "qual o resumo do financeiro?" },
      { id: "financeiro.vencimentos", title: "Vencimentos", description: "O que vence esta semana", permission: { appKey: "financeiro", action: "view" }, prompt: "o que vence essa semana?" },
      { id: "financeiro.despesa", title: "Lançar despesa", description: "Conta a pagar", permission: { appKey: "financeiro", action: "create" }, prompt: "quero lançar uma despesa" },
      { id: "financeiro.receita", title: "Lançar receita", description: "Conta a receber", permission: { appKey: "financeiro", action: "create" }, prompt: "quero lançar uma receita" },
    ],
  },
  // Fichas com próxima data (spec 0081). As frases usam "fichas", que vale para qualquer formulário
  // de ficha: o nome do ramo (manutenção, revisão) é da empresa, não do menu.
  {
    id: "fichas",
    title: "Fichas",
    shortTitle: "Fichas",
    description: "Atendimentos e próximas datas",
    appKey: "formularios",
    question: "O que você quer ver nas Fichas?",
    items: [
      { id: "fichas.hoje", title: "Previstas hoje", description: "Com as vencidas", permission: { appKey: "formularios", action: "view" }, prompt: "quais fichas tenho hoje?" },
      { id: "fichas.semana", title: "Previstas na semana", description: "Próximos 7 dias", permission: { appKey: "formularios", action: "view" }, prompt: "quais fichas tenho essa semana?" },
      { id: "fichas.vencidas", title: "Vencidas", description: "Data já passou", permission: { appKey: "formularios", action: "view" }, prompt: "quais fichas estão vencidas?" },
      { id: "fichas.faturado", title: "Faturado no mês", description: "Soma das fichas finalizadas", permission: { appKey: "formularios", action: "view" }, prompt: "quanto faturei esse mês?" },
      { id: "fichas.cliente", title: "Fichas de um cliente", description: "Pelo nome", permission: { appKey: "formularios", action: "view" }, hint: 'Escreva *fichas da* e o nome do cliente.\nEx.: "me mostra as fichas da Maria".' },
    ],
  },
  {
    id: "formularios",
    title: "Formulários",
    shortTitle: "Formulários",
    description: "Fichas e briefings",
    appKey: "formularios",
    question: "O que você quer fazer nos Formulários?",
    items: [
      { id: "formularios.ver", title: "Ver formulários", description: "Com as respostas", permission: { appKey: "formularios", action: "view" }, prompt: "quais formulários eu tenho?" },
      { id: "formularios.enviar", title: "Enviar a um lead", description: "Link do formulário", permission: { appKey: "formularios", action: "create" }, prompt: "quero enviar um formulário para um lead" },
    ],
  },
];

/** Apps que viram botão direto na saudação; o terceiro botão é "Mais opções". */
export const ROOT_SHORTCUT_APP_IDS = ["agenda", "demandas"];

/** O clique é de um botão que o Astro enviou? Os demais ids são de automações do tracking. */
export function isAstroBotReplyId(replyId: string | undefined): replyId is string {
  return Boolean(replyId) && (replyId!.startsWith(MENU_ID_PREFIX) || replyId!.startsWith(ANSWER_ID_PREFIX));
}
