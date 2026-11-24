// Verificação da spec 0150 (visual da proposta): totais, selo de desconto, seções, cores. Rodar: pnpm exec tsx scripts/forge-proposal-look-check.ts
import {
  normalizeProposalSections,
  normalizePaymentMethods,
  readableTextOn,
  resolveProposalLook,
  summarizeProposalLine,
  summarizeProposalTotals,
  textColorOnWhite,
} from "../src/features/forge/lib/proposal-look";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
  if (!isEqual) failures++;
  console.log(`${isEqual ? "ok  " : "FALHOU"} ${name}${isEqual ? "" : ` → veio ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`}`);
}

// CA-4: proposta #0002 da GOTHAN CODEX (Ace Chemicals).
const ace = [
  { quantity: 1, unitValue: 2500, discount: 0 },
  { quantity: 1, unitValue: 950, discount: 0 },
  { quantity: 1, unitValue: 1800, discount: 210 },
];
check("CA-4 totais da #0002", summarizeProposalTotals(ace, { value: 0, type: null }), { fullTotal: 5250, discountTotal: 210, total: 5040, savingsPercent: 4 });
check("CA-4 selo da Landing Page", summarizeProposalLine(ace[2]).discountPercent, 12);
check("sem desconto não tem selo", summarizeProposalLine(ace[0]).discountPercent, 0);
check("desconto da proposta em %", summarizeProposalTotals([{ quantity: 2, unitValue: 100, discount: 0 }], { value: 10, type: "PERCENTUAL" }).total, 180);
check("desconto da proposta em valor", summarizeProposalTotals([{ quantity: 2, unitValue: 100, discount: 0 }], { value: 50, type: "FIXO" }).total, 150);
check("desconto maior que o item fica no item", summarizeProposalLine({ quantity: 1, unitValue: 100, discount: 500 }).finalTotal, 0);

// Seções (casos de borda).
check("CA-1 sem configuração: todas ligadas, na ordem padrão", normalizeProposalSections(null).map((section) => section.id).join(","), "client,description,items,totals,payment,terms,responsible,cta");
check("seção que deixou de existir some", normalizeProposalSections([{ id: "antiga", enabled: true }, { id: "items", enabled: true }])[0].id, "items");
check("seção nova entra no fim, ligada", normalizeProposalSections([{ id: "cta", enabled: false }]).slice(-1)[0], { id: "responsible", enabled: true });
check(
  "itens e totais não ficam os dois desligados",
  normalizeProposalSections([{ id: "items", enabled: false }, { id: "totals", enabled: false }]).find((section) => section.id === "totals")?.enabled,
  true,
);
check("forma de pagamento repetida ou inválida sai", normalizePaymentMethods([{ method: "PIX" }, { method: "PIX" }]).length, 1);
check("lista de pagamento inválida vira vazia", normalizePaymentMethods([{ method: "CHEQUE" }]).length, 0);

// CA-7 e D-5: cor clara → texto escuro; cor escura → texto claro; texto colorido legível no branco.
check("CA-7 amarelo pede texto escuro", readableTextOn("#facc15"), "#14142b");
check("CA-7 roxo escuro pede texto claro", readableTextOn("#4f39d8"), "#ffffff");
check("amarelo escurece para virar texto no branco", textColorOnWhite("#facc15") !== "#facc15", true);
check("cor inválida volta ao padrão", resolveProposalLook({ brandColor: "vermelho" }).brandColor, "#4f39d8");
check("modelo inválido volta ao Moderno", resolveProposalLook({ proposalTemplate: "neon" }).template, "modern");

console.log(failures === 0 ? "\nTudo certo." : `\n${failures} verificação(ões) falharam.`);
process.exit(failures === 0 ? 0 : 1);
