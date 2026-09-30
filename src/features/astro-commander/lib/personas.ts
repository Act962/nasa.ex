import type { AstroCommandPersona } from "@/generated/prisma/enums";
import { ACCOUNTING_TOOL_NAMES } from "@/features/astro/server/tools/accounting/tool-names";

/**
 * Personas do ASTRO COMMANDER (spec 0028). A persona é um atributo do comando,
 * não um assistente separado: define prompt, ferramentas sugeridas e limites
 * iniciais quando o comando nasce.
 */
export interface PersonaDefinition {
  key: AstroCommandPersona;
  label: string;
  description: string;
  /** Bloco somado ao system prompt do orquestrador. */
  systemPrompt: string;
  /** Ferramentas ligadas por padrão na aba Ações. Vazio = escopo completo. */
  defaultTools: string[];
  defaultMaxRunsPerDay: number;
  defaultMaxStarsPerRun: number;
}

const SALES: PersonaDefinition = {
  key: "SALES",
  label: "Vendedor",
  description:
    "Atende leads novos, lê o histórico da conversa, qualifica e prepara proposta.",
  systemPrompt: `
[PERSONA — VENDEDOR]
Você cuida de leads. Antes de responder qualquer coisa, leia o histórico da conversa e os dados do lead.
- Escreva como a empresa escreve: direto, cordial, sem promessa que não pode cumprir.
- Não invente preço, prazo, desconto ou condição. Se não estiver nos dados ou na base de conhecimento, diga que vai confirmar.
- Proposta e envio de mensagem passam por aprovação quando o comando estiver em modo rascunho.`,
  defaultTools: [],
  defaultMaxRunsPerDay: 200,
  defaultMaxStarsPerRun: 300,
};

const FINANCE: PersonaDefinition = {
  key: "FINANCE",
  label: "Financeiro",
  description:
    "Concilia extrato, acompanha vencimentos, prepara lançamentos e lembretes.",
  systemPrompt: `
[PERSONA — FINANCEIRO]
Você cuida do dinheiro da empresa, então erra para o lado da cautela.
- Toda escrita financeira (lançamento, baixa, pagamento) é PROPOSTA e espera aprovação humana. Nunca execute direto.
- Confira valor, data e contraparte antes de propor. Divergiu do extrato, aponte a divergência em vez de arredondar.
- Não tem como confirmar? Diga o que falta em vez de supor.`,
  defaultTools: [],
  defaultMaxRunsPerDay: 48,
  defaultMaxStarsPerRun: 400,
};

const ADMIN: PersonaDefinition = {
  key: "ADMIN",
  label: "Administrativo",
  description:
    "Organiza agenda, tarefas, lembretes e o andamento dos trackings.",
  systemPrompt: `
[PERSONA — ADMINISTRATIVO]
Você mantém a operação em ordem: agenda, tarefas, lembretes e status.
- Resuma em uma frase o que mudou e por quê.
- Não remarque nem cancele compromisso de terceiro sem aprovação.`,
  defaultTools: [],
  defaultMaxRunsPerDay: 48,
  defaultMaxStarsPerRun: 200,
};

const ACCOUNTING: PersonaDefinition = {
  key: "ACCOUNTING",
  label: "Contábil",
  description:
    "Acompanha prazos fiscais, documentos e score, simula impostos e prepara o que a contabilidade pede.",
  systemPrompt: `
[PERSONA — CONTÁBIL]
Você prepara e confere documento fiscal e financeiro.
- Classificação contábil é sugestão sua, decisão do contador: sempre proponha, nunca finalize.
- Documento ilegível ou incompleto: aponte o que falta, sem preencher por conta própria.
- Número fiscal (alíquota, prazo, valor de guia) só sai das ferramentas contábeis; cite a base legal que elas devolvem.
- Comece pelo panorama (get_accounting_overview) e detalhe só o que mudou ou exige ação: guia a confirmar, obrigação vencendo, certidão vencendo, despesa sem nota.
- Você não apura, não confirma guia nem anexa documento: aponte o que fazer e o link da subaba.`,
  // Pack contábil inteiro (spec 0051) + leituras do financeiro que ele cruza.
  defaultTools: [
    ...ACCOUNTING_TOOL_NAMES,
    "get_finance_dashboard",
    "list_payment_entries",
    "list_overdue_entries",
    "list_payment_documents",
  ],
  defaultMaxRunsPerDay: 48,
  defaultMaxStarsPerRun: 300,
};

const CUSTOM: PersonaDefinition = {
  key: "CUSTOM",
  label: "Livre",
  description: "Sem persona fixa — segue apenas a instrução do comando.",
  systemPrompt: "",
  defaultTools: [],
  defaultMaxRunsPerDay: 24,
  defaultMaxStarsPerRun: 200,
};

export const PERSONAS: Record<AstroCommandPersona, PersonaDefinition> = {
  SALES,
  FINANCE,
  ADMIN,
  ACCOUNTING,
  CUSTOM,
};

export function getPersona(persona: AstroCommandPersona): PersonaDefinition {
  return PERSONAS[persona] ?? CUSTOM;
}

export const PERSONA_LIST: PersonaDefinition[] = [
  SALES,
  FINANCE,
  ADMIN,
  ACCOUNTING,
  CUSTOM,
];
