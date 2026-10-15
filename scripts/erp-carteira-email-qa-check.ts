// Specs 0106 e 0107: confere as regras puras da carteira do ERP, do email e da venda guiada. Rodar:
//   pnpm tsx --conditions=react-server scripts/erp-carteira-email-qa-check.ts
import "./lib/load-env-local";
import { toWhatsappPhone } from "../src/features/erp-carteira/lib/import-customers";
import { buildCustomerTags } from "../src/features/erp-carteira/lib/customer-tags";
import { isImportInProgress } from "../src/features/erp-carteira/server/run-import";
import { canConfirmManualPayment } from "../src/features/nerp-catalog/lib/manual-payment";
import { joinAsSingleMessage } from "../src/features/tracking-chat-ai/lib/split-message";
import { tiptapJsonToEmailHtml } from "../src/features/campanhas/email/tiptap-to-html";
import {
  applyEmailVariables,
  personalizeEmail,
  renderCampaignLayout,
} from "../src/features/campanhas/email/render-email";
import { createUnsubscribeToken, readUnsubscribeToken } from "../src/features/campanhas/email/unsubscribe-token";
import type { ErpCustomer } from "../src/http/nerp/erp-carteira";

let failureCount = 0;
function check(caseId: string, isPassing: boolean, detail = "") {
  console.log(`${isPassing ? "✅" : "❌"} ${caseId}${detail ? ` — ${detail}` : ""}`);
  if (!isPassing) failureCount += 1;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-15T12:00:00Z");

function customer(overrides: Partial<ErpCustomer> = {}): ErpCustomer {
  return {
    codigo: "100",
    nome: "MARIA DA SILVA",
    documento: "12345678909",
    telefones: ["86999998888"],
    email: "maria@exemplo.com",
    filial: { codigo: "1", nome: "ARMAZEM CARVALHO" },
    consultor: { codigo: "7", nome: "JOAO" },
    clienteDesde: "2010-01-01T00:00:00.000Z",
    primeiraCompra: "2010-02-01T00:00:00.000Z",
    ultimaCompra: new Date(now.getTime() - 10 * DAY_MS).toISOString(),
    valorUltimaCompra: 150,
    totalComprado: 5000,
    quantidadeDePedidos: 30,
    divida: null,
    interesses: ["LATICINIOS E FRIOS"],
    ultimosProdutos: ["LEITE"],
    pedidos: [],
    ...overrides,
  };
}

// ── Telefone do ERP → WhatsApp (0106, RF-3)
check("0106 RF-3 celular com DDD ganha 55", toWhatsappPhone("(86) 99999-8888") === "5586999998888");
check("0106 RF-3 fixo com DDD ganha 55", toWhatsappPhone("86 3222-1111") === "558632221111");
check("0106 RF-3 zero à esquerda sai", toWhatsappPhone("086999998888") === "5586999998888");
check("0106 RF-3 já com 55 fica igual", toWhatsappPhone("5586999998888") === "5586999998888");
check("0106 RF-3 número curto é recusado", toWhatsappPhone("99998888") === null);
check("0106 RF-3 lixo é recusado", toWhatsappPhone("sem telefone") === null);

// ── Tags da carteira (0106, RF-5)
const tagNames = (input: ErpCustomer) => buildCustomerTags(input, now).map((tag) => tag.name);
check("0106 RF-5 cliente em dia", tagNames(customer()).includes("Em dia") && !tagNames(customer()).includes("Inadimplente"));
check(
  "0106 CA-1 cliente com dívida é Inadimplente",
  tagNames(customer({ divida: { valor: 90, parcelas: 2, vencimentoMaisAntigo: "2026-09-01T00:00:00.000Z" } })).includes("Inadimplente"),
);
check("0106 RF-5 filial vira tag legível", tagNames(customer()).includes("Filial Armazem Carvalho"), tagNames(customer()).join(" | "));
check("0106 RF-5 interesse vira tag", tagNames(customer()).includes("Interesse: Laticinios E Frios"));
const inactive = (days: number) => tagNames(customer({ ultimaCompra: new Date(now.getTime() - days * DAY_MS).toISOString() }));
check("0106 RF-5 89 dias sem comprar não é inativo", !inactive(89).some((name) => name.startsWith("Inativo")));
check("0106 RF-5 90 dias é Inativo 90d", inactive(90).includes("Inativo 90d") && !inactive(90).includes("Inativo 180d"));
check("0106 RF-5 180 dias é só Inativo 180d", inactive(180).includes("Inativo 180d") && !inactive(180).includes("Inativo 90d"));
check("0106 RF-5 sem filial não cria tag de filial", !tagNames(customer({ filial: null })).some((name) => name.startsWith("Filial")));

// ── Importação travada (revisão: stuck import)
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);
check("0106 importação rodando há 5 min está em andamento", isImportInProgress({ status: "running", updatedAt: minutesAgo(5) }));
check("0106 importação parada há 25 min está travada", !isImportInProgress({ status: "running", updatedAt: minutesAgo(25) }));
check("0106 importação concluída não bloqueia", !isImportInProgress({ status: "done", updatedAt: minutesAgo(1) }));
check("0106 na fila há 25 min está travada", !isImportInProgress({ status: "queued", updatedAt: minutesAgo(25) }));

// ── Confirmar pagamento à mão
const approved = new Date();
check("pagamento manual: valor aprovado e sem Asaas libera", canConfirmManualPayment({ status: "NEGOTIATING", quoteApprovedAt: approved, asaasPaymentId: null }));
check("pagamento manual: sem aprovação do cliente bloqueia", !canConfirmManualPayment({ status: "NEGOTIATING", quoteApprovedAt: null, asaasPaymentId: null }));
check("pagamento manual: com cobrança no Asaas bloqueia", !canConfirmManualPayment({ status: "AWAITING_PAYMENT", quoteApprovedAt: approved, asaasPaymentId: "pay_123" }));
check("pagamento manual: já pago bloqueia", !canConfirmManualPayment({ status: "PAID", quoteApprovedAt: approved, asaasPaymentId: null }));

// ── Mensagem única do Astro
const longReply = Array.from({ length: 40 }, (_, index) => `Item ${index + 1}: produto com descrição.`).join("\n\n");
check("Astro: mensagem única padrão corta perto de 700", (joinAsSingleMessage(longReply)[0] ?? "").length <= 700);
check("Astro: pedido do catálogo cabe inteiro até 3.500", joinAsSingleMessage(longReply, 3500)[0]?.includes("Item 40") === true);
check("Astro: sempre uma mensagem só", joinAsSingleMessage(longReply, 3500).length === 1);

// ── Corpo do email (0107, RF-1)
const bodyHtml = tiptapJsonToEmailHtml({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Oi <script>x</script> {{primeiro_nome}}" }] },
    { type: "paragraph", content: [{ type: "text", text: "negrito", marks: [{ type: "bold" }] }] },
    { type: "paragraph", content: [{ type: "text", text: "site", marks: [{ type: "link", attrs: { href: "https://loja.com" } }] }] },
    { type: "paragraph", content: [{ type: "text", text: "perigo", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "um" }] }] }] },
  ],
});
check("0107 RF-1 texto do modelo é escapado", bodyHtml.includes("&lt;script&gt;") && !bodyHtml.includes("<script>"));
check("0107 RF-1 negrito vira <strong>", bodyHtml.includes("<strong>negrito</strong>"));
check("0107 RF-1 link http é mantido", bodyHtml.includes('href="https://loja.com"'));
check("0107 seg. link javascript: é descartado", !bodyHtml.includes("javascript:") && bodyHtml.includes("perigo"));
check("0107 RF-1 lista vira <ul><li>", bodyHtml.includes("<ul><li><p>um</p></li></ul>"));
check("0107 RF-1 JSON inválido não quebra", tiptapJsonToEmailHtml("{ruim") === "");

// ── Variáveis e montagem (0107, RF-1/RF-4)
const context = { name: "Ana <b>Lima</b>", email: "ana@exemplo.com", orgName: "Loja & Cia" };
check("0107 RF-1 primeiro_nome no assunto (sem escapar)", applyEmailVariables("{{primeiro_nome}}, oi", context, { isHtml: false }) === "Ana, oi");
check("0107 seg. variável no HTML é escapada", applyEmailVariables("{{nome}}", context, { isHtml: true }) === "Ana &lt;b&gt;Lima&lt;/b&gt;");
check("0107 RF-1 variável desconhecida fica como está", applyEmailVariables("{{cupom}}", context, { isHtml: false }) === "{{cupom}}");

async function main() {
  const layoutHtml = await renderCampaignLayout({ previewText: "Prévia", orgName: "Loja & Cia" });
  const email = personalizeEmail({
    layoutHtml,
    bodyHtml: "<p>Preço US$' e R$ 10 $& {{primeiro_nome}}</p>",
    subject: "Oi {{primeiro_nome}}",
    context,
    unsubscribeUrl: "https://orbita.test/email/descadastrar?t=abc",
  });
  check("0107 revisão: $& e $' do texto não são interpretados", email.html.includes("US$' e R$ 10 $&"));
  check("0107 RF-4 rodapé de descadastro sempre presente", email.html.includes("Não quero mais receber") && email.html.includes("descadastrar?t=abc"));
  check("0107 RF-3 nome da empresa escapado no rodapé", email.html.includes("Loja &amp; Cia"));
  check("0107 RF-1 assunto personalizado", email.subject === "Oi Ana");

  const token = createUnsubscribeToken("org-1", "Ana@Exemplo.com");
  const read = readUnsubscribeToken(token);
  check("0107 RF-4 link de descadastro lê empresa e email (minúsculo)", read?.organizationId === "org-1" && read.email === "ana@exemplo.com");
  const [payload, signature] = token.split(".");
  const forged = `${Buffer.from("org-2\nana@exemplo.com").toString("base64url")}.${signature}`;
  check("0107 seg. link adulterado é recusado", readUnsubscribeToken(forged) === null && readUnsubscribeToken(`${payload}.xxx`) === null);

  console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
  process.exit(failureCount === 0 ? 0 : 1);
}

main();
