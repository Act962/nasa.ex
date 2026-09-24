import "server-only";

// Apps que o Astro alcança (spec 0025). A etapa 1 da triagem classifica entre
// estes; a etapa 2 só vê os verbos do escolhido.
//
// A descrição é lida pelo modelo na etapa 1, então diz o que o app FAZ, não
// o que ele é — "onde ficam os leads" separa melhor que "CRM".

export const ASTRO_APPS = {
  // Dois apps porque a etapa 2 perde precisão acima de ~12 verbos (spec
  // 0025): o funil é a ESTRUTURA (quadro, colunas, quem participa); o lead é
  // a PESSOA que anda por ela.
  leads:
    "Clientes e contatos: criar lead, EDITAR dados do lead (telefone, e-mail, valor, temperatura), MOVER lead de coluna, apagar lead, favoritar, ANOTAR observação sobre um cliente",
  tracking:
    "Estrutura do funil: criar ou renomear TRACKING/funil, criar ou renomear COLUNA/etapa, criar ETIQUETA/tag, arquivar funil, dar acesso a colega no board. É o quadro e sua configuração, não as pessoas dentro dele",
  agenda:
    "Compromissos e tempo: criar AGENDA, marcar, remarcar, cancelar reunião, criar LEMBRETE, bloquear dia, ativar agenda",
  chat:
    "Conversas de WhatsApp: mandar mensagem ou TEMPLATE para alguém, abrir conversa por número, encaminhar, marcar como lida",
  forge:
    "Propostas comerciais e orçamentos: criar proposta com valor para um cliente",
  form:
    "Formulários, briefings e fichas de cadastro: mandar o FORMULÁRIO ao cliente, publicar, tirar do ar. Só quando a palavra formulário, briefing ou ficha aparecer",
  payment:
    "Financeiro/dinheiro: LANÇAR despesa ou receita, DAR BAIXA em conta paga/recebida, contas a pagar e receber, conciliação. Use quando a frase falar em R$, valor, despesa, gasto, receita ou pagamento",
  pages: "Sites e páginas publicadas",
  workspaces:
    "Quadros de trabalho interno da equipe: criar workspace, organizar tarefas do time (não é funil de leads)",
} as const;

export type AstroAppId = keyof typeof ASTRO_APPS;

export function appDescription(app: AstroAppId): string {
  return ASTRO_APPS[app];
}
