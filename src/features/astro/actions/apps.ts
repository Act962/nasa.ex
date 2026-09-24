import "server-only";

// Apps que o Astro alcança (spec 0025). A etapa 1 da triagem classifica entre
// estes; a etapa 2 só vê os verbos do escolhido.
//
// A descrição é lida pelo modelo na etapa 1, então diz o que o app FAZ, não
// o que ele é — "onde ficam os leads" separa melhor que "CRM".

export const ASTRO_APPS = {
  tracking:
    "Leads e funis: criar FUNIL/tracking, criar lead, MOVER lead de coluna, apagar, favoritar, ANOTAR/registrar observação em um cliente, colunas e participantes do board",
  agenda:
    "Compromissos e tempo: criar AGENDA, marcar, remarcar, cancelar reunião, criar LEMBRETE, bloquear dia, ativar agenda",
  chat:
    "Conversas de WhatsApp: mandar mensagem ou TEMPLATE para alguém, abrir conversa por número, encaminhar, marcar como lida",
  forge:
    "Propostas comerciais e orçamentos: criar proposta com valor para um cliente",
  form:
    "Formulários, briefings e fichas de cadastro: mandar o FORMULÁRIO ao cliente, publicar, tirar do ar. Só quando a palavra formulário, briefing ou ficha aparecer",
  payment:
    "Financeiro/dinheiro: LANÇAR despesa ou receita, contas a pagar e receber, conciliação. Use quando a frase falar em R$, valor, despesa, gasto, receita ou pagamento",
  pages: "Sites e páginas publicadas",
  workspaces:
    "Quadros de trabalho interno da equipe: criar workspace, organizar tarefas do time (não é funil de leads)",
} as const;

export type AstroAppId = keyof typeof ASTRO_APPS;

export function appDescription(app: AstroAppId): string {
  return ASTRO_APPS[app];
}
