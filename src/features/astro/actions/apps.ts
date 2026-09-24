import "server-only";

// Apps que o Astro alcança (spec 0025). A etapa 1 da triagem classifica entre
// estes; a etapa 2 só vê os verbos do escolhido.
//
// A descrição é lida pelo modelo na etapa 1, então diz o que o app FAZ, não
// o que ele é — "onde ficam os leads" separa melhor que "CRM".

export const ASTRO_APPS = {
  tracking:
    "Leads e funis: criar, mover, apagar, favoritar lead, ANOTAR/registrar observação em um cliente, colunas e participantes do board",
  agenda:
    "Compromissos e tempo: marcar, remarcar, cancelar reunião, criar LEMBRETE, bloquear dia, ativar agenda",
  chat:
    "Conversas de WhatsApp: enviar mensagem ou template, abrir conversa por número, encaminhar, marcar como lida",
  forge:
    "Propostas comerciais e orçamentos: criar proposta com valor para um cliente",
  form: "Formulários e briefings: enviar o link ao cliente, publicar, tirar do ar",
  payment: "Financeiro: contas a pagar e receber, lançamentos, conciliação",
  pages: "Sites e páginas publicadas",
} as const;

export type AstroAppId = keyof typeof ASTRO_APPS;

export function appDescription(app: AstroAppId): string {
  return ASTRO_APPS[app];
}
