import type { AstroRouteContext } from "@/features/astro/schemas/chat-message";
import { WRITE_VERB, normalizeQuestion } from "./types";

// Pergunta fiscal/contábil não tem resposta em código: "quais documentos estão
// vencidos?" casava com o resumo de contas a pagar, e "quais certidões estão
// vencendo?" com o vencimento de lançamentos. Estas vão direto ao orquestrador,
// que tem as tools da aba Contábil.

const ACCOUNTING_TERMS = new RegExp(
  [
    "\\bimpostos?\\b",
    "\\btribut",
    "\\bfisca(l|is)\\b",
    "\\bfisco\\b",
    "\\bcontab",
    "\\bcontador",
    "\\b(de|o|do|meu|no|pro|pelo|um) das\\b",
    "\\bdas[- ]mei\\b",
    "\\bsimples nacional\\b",
    "\\bmei\\b",
    "\\blucro (presumido|real)\\b",
    "\\bregime\\b",
    "\\baliquotas?\\b",
    "\\bfator r\\b",
    "\\brbt12\\b",
    "\\banexo (i|ii|iii|iv|v|1|2|3|4|5)\\b",
    "\\bcbs\\b",
    "\\bibs\\b",
    "\\bimposto seletivo\\b",
    "\\breforma( tributaria)?\\b",
    "\\bsplit payment\\b",
    "\\bcclasstrib\\b",
    "\\bncm\\b",
    "\\bnbs\\b",
    "\\biss(qn)?\\b",
    "\\bicms\\b",
    "\\bpis\\b",
    "\\bcofins\\b",
    "\\birpj\\b",
    "\\bcsll\\b",
    "\\birrf\\b",
    "\\bretenc(ao|oes)\\b",
    "\\bpro[- ]?labore\\b",
    "\\bdistribuicao de lucros?\\b",
    "\\bcertid(ao|oes)\\b",
    "\\bcnd\\b",
    "\\bcndt\\b",
    "\\bcrf\\b",
    "\\balvaras?\\b",
    "\\bcertificado digital\\b",
    "\\bregularidade\\b",
    "\\b(empresa|cnpj) (esta )?regular\\b",
    "\\blicitac",
    "\\bapurac(ao|oes)\\b",
    "\\bapurar\\b",
    "\\bguias?\\b",
    "\\bobrigac(ao|oes) (acessoria|fiscal|fiscais|acessorias)\\b",
    "\\bdeclarac(ao|oes)\\b",
    "\\b(defis|dasn|dctf|dctfweb|sped|efd|esocial|fgts)\\b",
    "\\bcreditos? (de|do|tributario)",
    "\\bbalancete\\b",
    "\\bbalanco\\b",
    "\\bpatrimonio\\b",
    "\\bplano de contas\\b",
    "\\blivro razao\\b",
    "\\bpartidas? dobradas?\\b",
    "\\bsem nota\\b",
    "\\bmarkup\\b",
    "\\bprecifica",
    "\\bdocumentos? da empresa\\b",
    "\\bdocumentos?\\b.*\\b(vencid|vencend|vence|validade|faltando|falta|pendente)",
  ].join("|"),
);

// Na aba Contábil, pergunta curta sobre prazo/pendência é da subaba aberta
// ("o que está vencido?" no Calendário = guias).
const ACCOUNTING_TAB_TOPICS = /\b(venc|atras|pendenc|pendente|falt|regular|score|prazo|credito|preco|document|pagar|pago|paguei|quanto)/;

export function isAccountingQuestion(text: string, route?: AstroRouteContext): boolean {
  const normalized = normalizeQuestion(text);
  if (!normalized || WRITE_VERB.test(normalized)) return false;
  if (ACCOUNTING_TERMS.test(normalized)) return true;
  return route?.paymentTab === "accounting" && ACCOUNTING_TAB_TOPICS.test(normalized);
}
