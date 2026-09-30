/**
 * Exemplos de "Criar comando" por área (spec 0029, RF-12). Módulo comum, sem
 * "use client": páginas de servidor também passam estes exemplos ao cabeçalho.
 */
export const ASTRO_COMMAND_EXAMPLES = {
  /** Página do próprio App ASTRO: exemplos de áreas diferentes. */
  astro: [
    "todo dia às 8h conciliar o extrato e me mandar o resumo",
    "responder leads novos, ler todo o histórico e enviar proposta caso precise",
    "toda segunda às 9h me mandar as conversas sem resposta",
  ],
  contacts: [
    "todo dia às 9h me mandar os leads sem responsável",
    "quando entrar lead novo, qualificar e atribuir a um vendedor",
    "toda sexta me mandar os contatos que não respondem há 7 dias",
  ],
  chat: [
    "responder leads novos, ler todo o histórico e enviar proposta caso precise",
    "quando um lead ficar 5 minutos sem resposta, preparar uma resposta pra eu revisar",
    "todo dia às 18h resumir as conversas sem resposta",
  ],
  tracking: [
    "todo dia às 8h me dizer os leads parados há mais de 3 dias",
    "quando um lead mudar para Proposta, preparar a proposta no Forge",
    "toda segunda me mandar a previsão de fechamento da semana",
  ],
  payment: [
    "todo dia às 8h conciliar extrato",
    "todo dia às 9h me avisar o que vence hoje",
    "toda segunda me mandar o fluxo de caixa da semana",
  ],
  accounting: [
    "toda segunda às 8h me dizer as guias e declarações que vencem na semana",
    "todo dia 5 me mandar a simulação do DAS do mês passado",
    "todo dia 1º me listar as certidões que vencem nos próximos 30 dias",
    "todo dia 10 me avisar se a apuração do mês passado ainda não foi confirmada",
    "toda sexta me listar as despesas pagas sem nota e o crédito que estou perdendo",
    "todo dia 1º me mandar o resumo contábil: score, pendências e balanço do mês",
  ],
  agenda: [
    "todo dia às 7h30 me mandar a agenda do dia",
    "quando um compromisso for cancelado, sugerir novo horário ao lead",
    "toda sexta me mandar os compromissos da próxima semana",
  ],
  workspace: [
    "todo dia às 9h me dizer as tarefas que vencem hoje",
    "quando uma tarefa atrasar, avisar o responsável",
    "toda segunda resumir o andamento das tarefas da equipe",
  ],
  forge: [
    "todo dia às 8h me avisar os contratos que vencem em 7 dias",
    "quando uma proposta for visualizada, me avisar para fazer follow-up",
    "toda segunda listar as propostas enviadas sem resposta",
  ],
} as const satisfies Record<string, readonly string[]>;
