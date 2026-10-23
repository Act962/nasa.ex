// Padrões da régua de cobrança (spec 0115): prazos prontos, modelos de mensagem em tom
// respeitoso e o alerta de termos que soam como ameaça ou constrangimento — o CDC (art. 42)
// proíbe expor o cliente ao ridículo, constranger ou ameaçar na cobrança. O usuário pode
// personalizar tudo; os padrões só tornam o caminho certo o mais fácil.

/** Limites aceitos pelo servidor para `daysOffset`. */
export const MAX_DAYS_BEFORE = 30;
export const MAX_DAYS_AFTER = 60;

export type DunningPhase = "before" | "due" | "after";

export function phaseOf(daysOffset: number): DunningPhase {
  if (daysOffset < 0) return "before";
  if (daysOffset === 0) return "due";
  return "after";
}

export function describeTiming(daysOffset: number): string {
  if (daysOffset === 0) return "No dia do vencimento";
  const days = Math.abs(daysOffset);
  const unit = days === 1 ? "dia" : "dias";
  return daysOffset < 0 ? `${days} ${unit} antes do vencimento` : `${days} ${unit} depois do vencimento`;
}

export const TIMING_PRESETS: ReadonlyArray<number> = [-7, -5, -3, -1, 0, 1, 3, 5, 7, 15, 30];

export type DunningVariable = { token: string; label: string; example: string };

export const DUNNING_VARIABLES: ReadonlyArray<DunningVariable> = [
  { token: "{{contato}}", label: "Nome do cliente", example: "Maria" },
  { token: "{{valor}}", label: "Valor", example: "R$ 150,00" },
  { token: "{{vencimento}}", label: "Vencimento", example: "30/10/2026" },
  { token: "{{descricao}}", label: "Descrição", example: "Mensalidade de outubro" },
  { token: "{{empresa}}", label: "Sua empresa", example: "Sua Empresa" },
  { token: "{{link_pagamento}}", label: "Link de pagamento", example: "https://…/cobranca/abc" },
  { token: "{{pix_copia_e_cola}}", label: "PIX copia e cola", example: "00020126…" },
  { token: "{{outras_pendencias}}", label: "Outras pendências", example: "R$ 0,00" },
];

export function renderDunningPreview(template: string): string {
  return DUNNING_VARIABLES.reduce(
    (text, variable) => text.split(variable.token).join(variable.example),
    template,
  );
}

export type DunningMessageTemplate = { id: string; label: string; body: string; subject: string };

export const DUNNING_MESSAGE_TEMPLATES: Record<DunningPhase, ReadonlyArray<DunningMessageTemplate>> = {
  before: [
    {
      id: "before-friendly",
      label: "Lembrete amigável",
      subject: "Lembrete: {{descricao}} vence em {{vencimento}}",
      body:
        "Olá, {{contato}}! Aqui é da {{empresa}}. Passando para lembrar que {{descricao}}, no valor de {{valor}}, vence em {{vencimento}}.\n" +
        "Para pagar pelo PIX: {{link_pagamento}}\n" +
        "Se já pagou, desconsidere esta mensagem.",
    },
    {
      id: "before-short",
      label: "Lembrete curto",
      subject: "{{descricao}} vence em {{vencimento}}",
      body: "Oi, {{contato}}! {{descricao}} ({{valor}}) vence em {{vencimento}}. Link para pagamento: {{link_pagamento}}",
    },
  ],
  due: [
    {
      id: "due-today",
      label: "Vence hoje",
      subject: "{{descricao}} vence hoje",
      body:
        "Olá, {{contato}}! Aqui é da {{empresa}}. Hoje é o vencimento de {{descricao}}, no valor de {{valor}}.\n" +
        "Para pagar agora pelo PIX: {{link_pagamento}}\n" +
        "Se já pagou, desconsidere esta mensagem.",
    },
  ],
  after: [
    {
      id: "after-gentle",
      label: "Atraso — tom gentil",
      subject: "{{descricao}} está em aberto",
      body:
        "Olá, {{contato}}! Aqui é da {{empresa}}. Notamos que {{descricao}}, no valor de {{valor}}, com vencimento em {{vencimento}}, ainda está em aberto.\n" +
        "Para pagar pelo PIX: {{link_pagamento}}\n" +
        "Se já pagou ou precisa combinar outra data, é só responder esta mensagem.",
    },
    {
      id: "after-negotiation",
      label: "Atraso — oferecer acordo",
      subject: "Vamos resolver {{descricao}}?",
      body:
        "Olá, {{contato}}. Aqui é da {{empresa}}. {{descricao}} ({{valor}}) venceu em {{vencimento}} e segue em aberto.\n" +
        "Se estiver com alguma dificuldade, responda esta mensagem que buscamos uma forma de pagamento que caiba para você.\n" +
        "Link para pagamento: {{link_pagamento}}",
    },
  ],
};

export function defaultTemplateFor(daysOffset: number): DunningMessageTemplate {
  return DUNNING_MESSAGE_TEMPLATES[phaseOf(daysOffset)][0];
}

/** Régua que já nasce pronta: lembrete antes, aviso no dia e um aviso gentil depois. */
export const DEFAULT_RULE_STEPS: ReadonlyArray<{ daysOffset: number; channel: "WHATSAPP" }> = [
  { daysOffset: -3, channel: "WHATSAPP" },
  { daysOffset: 0, channel: "WHATSAPP" },
  { daysOffset: 3, channel: "WHATSAPP" },
];

const RISKY_TERMS: ReadonlyArray<string> = [
  "protesto",
  "protestar",
  "processo",
  "processar",
  "justiça",
  "judicial",
  "advogado",
  "polícia",
  "prisão",
  "nome sujo",
  "caloteiro",
  "calote",
  "vergonha",
  "última chance",
  "ultima chance",
  "spc",
  "serasa",
  "negativação",
  "negativar",
];

/** Termos da mensagem que podem soar como ameaça ou constrangimento. */
export function findRiskyTerms(text: string): string[] {
  const normalized = text.toLowerCase();
  return RISKY_TERMS.filter((term) => normalized.includes(term));
}
