// Spec 0103: confere o cálculo do valor negociado e o bloqueio de cobrança. Rodar:
//   pnpm tsx scripts/catalog-quote-qa-check.ts
import { computeQuotedTotals, getChargeBlockReason, InvalidQuoteError } from "../src/features/nerp-catalog/lib/order-quote";
import type { CatalogOrderItem } from "../src/features/nerp-catalog/schemas/order-payload";

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

console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
process.exit(failureCount === 0 ? 0 : 1);
