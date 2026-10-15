// Spec 0103: confere o cálculo do valor negociado e o bloqueio de cobrança. Rodar:
//   pnpm tsx scripts/catalog-quote-qa-check.ts
import { computeQuotedTotals, getChargeBlockReason, InvalidQuoteError } from "../src/features/nerp-catalog/lib/order-quote";
import type { CatalogOrderItem } from "../src/features/nerp-catalog/schemas/order-payload";
import {
  buildApprovalPayload,
  canDecideApproval,
  isApprovalReminderDue,
  parseApprovalPayload,
  buildOpenApprovalPayload,
  parseOpenApprovalPayload,
  summarizeRound,
  toTemplateParameter,
} from "../src/features/nerp-catalog/lib/approvals/approval-rules";
import { buildCustomerQuoteMessage, buildPointsSentence, formatDeliveryDate } from "../src/features/nerp-catalog/lib/approvals/approval-messages";
import { hasOpenTeamApprovals, isAwaitingDeliveryChange, pickChatCatalogOrders } from "../src/features/nerp-catalog/lib/chat-order-actions";
import { extractOrderCode } from "../src/features/nerp-catalog/utils/format-order";
import { extractDocument, isAffirmativeWithoutName, matchConsultants } from "../src/features/workflows/lib/catalog-sales-matching";

let failureCount = 0;
function check(caseId: string, isPassing: boolean, detail = "") {
  console.log(`${isPassing ? "✅" : "❌"} ${caseId}${detail ? ` — ${detail}` : ""}`);
  if (!isPassing) failureCount += 1;
}

const buildItem = (name: string, quantity: number): CatalogOrderItem => ({ productId: name, name, sku: null, quantity, unitPrice: 0, total: 0, imageUrl: null });
const noQuote = { quoteRequestedAt: null, quotedAt: null, quoteApprovedAt: null };
const now = new Date();

check("CA-1 pedido R$ 0 bloqueia cobrança", getChargeBlockReason({ total: 0, ...noQuote })?.includes("sem valor") === true);
check("CA-2 orçamento pedido sem valor bloqueia", getChargeBlockReason({ total: 50, ...noQuote, quoteRequestedAt: now })?.includes("aguardando o valor") === true);
check("CA-3 valor enviado e não aprovado bloqueia", getChargeBlockReason({ total: 50, ...noQuote, quoteRequestedAt: now, quotedAt: now })?.includes("aprovação") === true);
check("CA-4 valor aprovado libera", getChargeBlockReason({ total: 50, quoteRequestedAt: now, quotedAt: now, quoteApprovedAt: now }) === null);
check("CA-5 pedido antigo com valor libera", getChargeBlockReason({ total: 50, ...noQuote }) === null);

const quoted = computeQuotedTotals([buildItem("Arroz", 3), buildItem("Feijão", 2)], { unitPrices: [10, 2.5], shipping: 5, discount: 1 });
check(
  "CA-6 totais recalculados",
  quoted.items[0].total === 30 && quoted.items[1].total === 5 && quoted.subtotal === 35 && quoted.total === 39,
  JSON.stringify({ items: quoted.items.map((item) => item.total), subtotal: quoted.subtotal, total: quoted.total }),
);

const expectInvalid = (caseId: string, run: () => unknown) => {
  try {
    run();
    check(caseId, false, "não recusou");
  } catch (error) {
    check(caseId, error instanceof InvalidQuoteError, error instanceof Error ? error.message : "");
  }
};
expectInvalid("CA-7 desconto que zera o total é recusado", () => computeQuotedTotals([buildItem("Arroz", 1)], { unitPrices: [10], shipping: 0, discount: 10 }));
expectInvalid("CB-9 lista de preços de tamanho diferente é recusada", () => computeQuotedTotals([buildItem("Arroz", 1)], { unitPrices: [10, 5], shipping: 0, discount: 0 }));
expectInvalid("valor negativo é recusado", () => computeQuotedTotals([buildItem("Arroz", 1)], { unitPrices: [-1], shipping: 0, discount: 0 }));

const fractional = computeQuotedTotals([buildItem("Queijo (kg)", 0.335)], { unitPrices: [59.9], shipping: 0, discount: 0 });
check("CB-8 quantidade fracionada arredonda a centavos", fractional.total === 20.07, String(fractional.total));
const floating = computeQuotedTotals([buildItem("A", 3)], { unitPrices: [0.1], shipping: 0.2, discount: 0 });
check("totais sem erro de ponto flutuante", floating.total === 0.5, String(floating.total));
const boxPriced = computeQuotedTotals([buildItem("Refrigerante (cx 12)", 24)], { unitPrices: [100 / 12], shipping: 0, discount: 0 });
check("CA-14 preço por caixa fecha a caixa exata", boxPriced.total === 200 && boxPriced.items[0].unitPrice === 8.33, JSON.stringify({ total: boxPriced.total, unitPrice: boxPriced.items[0].unitPrice }));

// ── Spec 0104 — venda guiada com aprovação dos setores ──────────────────────
check(
  "0104 CA-9 cobrança bloqueada com aprovação interna aberta",
  getChargeBlockReason({ total: 50, ...noQuote, quoteRequestedAt: now, quotedAt: now, internalApprovalStartedAt: now, internalApprovedAt: null })?.includes("aprovação interna") === true,
);
check(
  "0104 CA-8 aprovado pela equipe e pelo cliente libera",
  getChargeBlockReason({ total: 50, quoteRequestedAt: now, quotedAt: now, quoteApprovedAt: now, internalApprovalStartedAt: now, internalApprovedAt: now }) === null,
);

const approver = { organizationId: "org-a", sector: "FINANCE" as const, rounds: ["PRE_PAYMENT" as const], isActive: true };
const approval = { organizationId: "org-a", sector: "FINANCE" as const, round: "PRE_PAYMENT" as const, status: "PENDING" as const };
check("0104 CA-6 aprovador do setor decide", canDecideApproval(approver, approval));
check("0104 CA-6 outro setor não decide", !canDecideApproval({ ...approver, sector: "COMMERCIAL" }, approval));
check("0104 CA-6 outra org não decide", !canDecideApproval({ ...approver, organizationId: "org-b" }, approval));
check("0104 CA-6 rodada que não é dele não decide", !canDecideApproval(approver, { ...approval, round: "POST_PAYMENT" }));
check("0104 CA-6 aprovação já decidida não muda", !canDecideApproval(approver, { ...approval, status: "APPROVED" }));

const payload = buildApprovalPayload("ckabc1234567890xyz", "adjust");
const parsedPayload = parseApprovalPayload(payload);
check("0104 payload do botão ida e volta", parsedPayload?.approvalId === "ckabc1234567890xyz" && parsedPayload.decision === "adjust", payload);
check("0104 payload estranho é ignorado", parseApprovalPayload("Fechar pedido") === null);
const openPayload = buildOpenApprovalPayload("cmv8j7fgz00xm01p63wb5t1yt");
check("0104 CB-3 botão Abrir pedido do lembrete nunca decide", parseApprovalPayload(openPayload) === null);
check("0104 CB-3 botão Abrir pedido aponta a aprovação", parseOpenApprovalPayload(openPayload) === "cmv8j7fgz00xm01p63wb5t1yt");

const friday = new Date("2026-10-16T14:00:00Z");
const thursday = new Date("2026-10-15T14:00:00Z");
check("0104 CB-2 rodada aberta enquanto houver setor pendente", summarizeRound([
  { sector: "FINANCE", status: "APPROVED", note: null, proposedDeliveryAt: null },
  { sector: "LOGISTICS", status: "PENDING", note: null, proposedDeliveryAt: null },
]).kind === "open");
const approvedRound = summarizeRound([
  { sector: "FINANCE", status: "APPROVED", note: null, proposedDeliveryAt: null },
  { sector: "LOGISTICS", status: "APPROVED", note: "amanhã 11h", proposedDeliveryAt: thursday },
  { sector: "COMMERCIAL", status: "CANCELED", note: null, proposedDeliveryAt: null },
]);
check("0104 CA-8 todos aprovaram e o prazo vem da logística", approvedRound.kind === "approved" && approvedRound.deliveryPromiseAt?.getTime() === thursday.getTime());
const delayedRound = summarizeRound([
  { sector: "FINANCE", status: "APPROVED", note: null, proposedDeliveryAt: null },
  { sector: "LOGISTICS", status: "ADJUSTED", note: "só sexta", proposedDeliveryAt: friday },
]);
check("0104 CA-11 ajuste só de prazo segue aprovado com o prazo novo", delayedRound.kind === "approved" && delayedRound.deliveryPromiseAt?.getTime() === friday.getTime());
check("0104 recusa volta ao consultor", summarizeRound([
  { sector: "FINANCE", status: "REJECTED", note: "cliente com dívida", proposedDeliveryAt: null },
  { sector: "LOGISTICS", status: "APPROVED", note: null, proposedDeliveryAt: thursday },
]).kind === "back_to_consultant");
check("0104 ajuste sem prazo volta ao consultor", summarizeRound([{ sector: "COMMERCIAL", status: "ADJUSTED", note: "baixar 5%", proposedDeliveryAt: null }]).kind === "back_to_consultant");

check("0104 CB-3 lembrete depois de 2h em horário comercial", isApprovalReminderDue({ lastSentAt: new Date(now.getTime() - 3 * 3600_000), now, localHour: 10, localWeekday: 2 }));
check("0104 CB-3 sem lembrete fora do horário", !isApprovalReminderDue({ lastSentAt: new Date(now.getTime() - 3 * 3600_000), now, localHour: 21, localWeekday: 2 }));
check("0104 CB-3 sem lembrete no domingo", !isApprovalReminderDue({ lastSentAt: new Date(now.getTime() - 3 * 3600_000), now, localHour: 10, localWeekday: 0 }));

check("0104 parâmetro de template sem quebra de linha", toTemplateParameter("linha 1\nlinha 2\t\tfim") === "linha 1 linha 2 fim");
check("0104 parâmetro de template nunca vazio", toTemplateParameter("   ") === "-");
check("0104 data de entrega por extenso", formatDeliveryDate(new Date("2026-10-16T14:00:00Z")) === "sexta, 16/10 às 11h", formatDeliveryDate(new Date("2026-10-16T14:00:00Z")));

check("0104 CA-13 frase de pontos", buildPointsSentence(10)?.includes("10 pontos") === true);
check("0104 CA-13 sem programa não cita pontos", buildPointsSentence(null) === null);
const customerQuote = buildCustomerQuoteMessage({
  customerName: "Maria Souza", saleNumber: 1234, items: [buildItem("Arroz", 3)], shipping: 0, discount: 0, total: 200, deliveryPromiseAt: thursday, points: 10,
});
check("0104 CA-8 mensagem ao cliente com valor, prazo e pontos", customerQuote.text.includes("R$") && customerQuote.text.includes("quinta") && customerQuote.text.includes("10 pontos"));
check("0104 template do valor tem 5 parâmetros, nenhum vazio", customerQuote.templateParameters.length === 5 && customerQuote.templateParameters.every((value) => value.trim().length > 0));

check("0104 RF-7 lê CPF formatado no meio da frase", extractDocument("meu cpf é 529.982.247-25 blz") === "52998224725");
check("0104 RF-7 lê CNPJ", extractDocument("cnpj 11.222.333/0001-81") === "11222333000181");
check("0104 RF-7 recusa número inválido", extractDocument("123.456.789-00") === null);
const consultants = [{ name: "Marcos Silva" }, { name: "João Pereira" }, { name: "João Lima" }];
check("0104 CA-2 acha consultor pelo primeiro nome", matchConsultants("é o marcos", consultants).length === 1);
check("0104 CB-8 nome ambíguo não decide", matchConsultants("o joão", consultants).length === 2);
check("0104 CA-16 código do texto pronto do WhatsApp", extractOrderCode("Olá! Quero finalizar meu pedido #2 (código FK2VOE).") === "FK2VOE");
check("0104 CB-11 sem código não inventa pedido", extractOrderCode("oi, quero ver meu pedido") === null);
check("0104 CA-2 botão Tenho sim pede o nome", isAffirmativeWithoutName("Tenho sim") && isAffirmativeWithoutName("sim, tenho"));
check("0104 CA-2 Não tenho e nome não pedem o nome de novo", !isAffirmativeWithoutName("Não tenho") && !isAffirmativeWithoutName("tenho, é o Marcos"));
check("0104 CB-8 nome completo desempata", matchConsultants("joão lima", consultants).length === 1);

// ── Aba Pedido do chat: quais pedidos aparecem (0104 RF-10)
const paidOrder = { status: "PAID", pendingApprovalCount: 2, pendingDeliveryChangeAt: null, postPaymentApprovedAt: null };
check("0104 RF-10 pago com setor pendente aparece", hasOpenTeamApprovals(paidOrder));
check("0104 RF-10 cancelado com setor pendente não aparece", !hasOpenTeamApprovals({ ...paidOrder, status: "CANCELED" }));
const adjustedOrder = { status: "PAID", pendingApprovalCount: 0, pendingDeliveryChangeAt: friday, postPaymentApprovedAt: null };
check("0104 RF-10 prazo ajustado esperando o cliente continua aparecendo", hasOpenTeamApprovals(adjustedOrder) && isAwaitingDeliveryChange(adjustedOrder));
check("0104 RF-10 prazo aceito pelo cliente sai da aba", !hasOpenTeamApprovals({ ...adjustedOrder, postPaymentApprovedAt: thursday }));
check("0104 RF-10 conferência concluída sai da aba", !hasOpenTeamApprovals({ ...paidOrder, pendingApprovalCount: 0, postPaymentApprovedAt: thursday }));
const chatOrders = pickChatCatalogOrders([
  { saleNumber: 6, canSendQuote: true, canConfirmPayment: false, hasOpenApprovals: false },
  { saleNumber: 5, canSendQuote: false, canConfirmPayment: false, hasOpenApprovals: true },
  { saleNumber: 4, canSendQuote: false, canConfirmPayment: false, hasOpenApprovals: false },
]);
check("0104 RF-10 pedido novo não esconde a conferência do anterior", chatOrders.map((order) => order.saleNumber).join(",") === "6,5");

console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
process.exit(failureCount === 0 ? 0 : 1);
