// Conferência das funções puras da aba Contábil contra os casos de referência
// da spec 0051. Não há runner de testes no projeto (CLAUDE.md, regra 20): cada
// CA-n vira uma asserção aqui.
//
//   pnpm tsx scripts/accounting-qa-check.ts

import { DEFAULT_TAX_RATES } from "../src/features/accounting/lib/tax/seed/default-tax-rates";
import type { TaxRateRow } from "../src/features/accounting/lib/tax/types";
import { computeDas } from "../src/features/accounting/lib/tax/simples/compute-das";
import { computeRbt12 } from "../src/features/accounting/lib/tax/simples/compute-rbt12";
import { computeDasMei } from "../src/features/accounting/lib/tax/mei/compute-das-mei";
import { computeIrpjCsllPresumido, computeMonthlyContributions } from "../src/features/accounting/lib/tax/presumido/compute-presumido";
import { computeCbsIbs } from "../src/features/accounting/lib/tax/reforma/compute-cbs-ibs";
import { computeMarkupPrice } from "../src/features/accounting/lib/pricing/compute-pricing";
import { computeEffectiveRate } from "../src/features/accounting/lib/pricing/compute-effective-rate";
import { computeLatePayment } from "../src/features/accounting/lib/tax/late-payment/compute-late-payment";
import { computeProLabore } from "../src/features/accounting/lib/tax/payroll/compute-payroll";
import { computeWithholdings } from "../src/features/accounting/lib/tax/withholding/compute-withholdings";
import { computeRegularityScore } from "../src/features/accounting/lib/compliance/compute-regularity-score";
import { COMPANY_DOCUMENT_TYPES, isDocumentApplicable } from "../src/features/accounting/lib/compliance/document-catalog";
import { buildEntryJournal, isJournalBalanced } from "../src/features/accounting/lib/journal/build-entry-journal";
import { parseFiscalXml } from "../src/features/accounting/lib/nfe-xml/parse-fiscal-xml";
import { buildFiscalCalendar } from "../src/features/accounting/lib/fiscal-calendar/build-fiscal-calendar";
import { CALCULATORS, runCalculator } from "../src/features/accounting/lib/calculator/calculator-registry";
import { GLOSSARY_TERMS, findGlossaryTerm } from "../src/features/accounting/lib/glossary/terms";

const rates: TaxRateRow[] = DEFAULT_TAX_RATES.map((seed) => ({
  tax: seed.tax,
  regime: seed.regime,
  annex: seed.annex,
  bracket: seed.bracket,
  revenueFromCents: seed.revenueFromCents,
  revenueToCents: seed.revenueToCents,
  rateBps: seed.rateBps,
  deductionCents: seed.deductionCents,
  fixedAmountCents: seed.fixedAmountCents,
  municipioIbge: seed.municipioIbge,
  cClassTrib: null,
  reductionBps: seed.reductionBps,
  validFrom: new Date(`${seed.validFrom}T00:00:00Z`),
  validTo: seed.validTo ? new Date(`${seed.validTo}T23:59:59Z`) : null,
  legalSource: seed.legalSource,
  note: seed.note,
}));

const at2026 = new Date("2026-09-15T12:00:00Z");
let failures = 0;
let passes = 0;

function check(caseId: string, description: string, actual: unknown, expected: unknown) {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
  if (isEqual) {
    passes += 1;
    console.log(`  ✓ ${caseId} — ${description}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${caseId} — ${description}\n      esperado: ${JSON.stringify(expected)}\n      obtido:   ${JSON.stringify(actual)}`);
  }
}

console.log("\nMotor fiscal");

const dasAnnexIII = computeDas({
  rbt12Cents: 30_000_000,
  monthRevenueByAnnex: { III: 3_000_000 },
  payroll12mCents: 0,
  isFatorRSubject: false,
  rates,
  at: at2026,
});
check("CA-4", "DAS Anexo III, RBT12 R$ 300 mil: alíquota efetiva 8,08%", dasAnnexIII.output.lines[0]?.effectiveRateBps, 808);
check("CA-4", "DAS Anexo III sobre R$ 30 mil = R$ 2.424,00", dasAnnexIII.output.totalAmountCents, 242_400);

const dasWithFatorR = computeDas({
  rbt12Cents: 60_000_000,
  monthRevenueByAnnex: { V: 5_000_000 },
  payroll12mCents: 18_000_000,
  isFatorRSubject: true,
  rates,
  at: at2026,
});
check("CA-5", "Fator R 30% leva do Anexo V ao III", dasWithFatorR.output.lines[0]?.appliedAnnex, "III");
check("CA-5", "DAS com Fator R ≥ 28% = R$ 5.280,00", dasWithFatorR.output.totalAmountCents, 528_000);

const dasWithoutFatorR = computeDas({
  rbt12Cents: 60_000_000,
  monthRevenueByAnnex: { V: 5_000_000 },
  payroll12mCents: 10_000_000,
  isFatorRSubject: true,
  rates,
  at: at2026,
});
check("CA-5", "Fator R 16,67% fica no Anexo V: R$ 8.925,00", dasWithoutFatorR.output.totalAmountCents, 892_500);

const rbt12New = computeRbt12({
  periodMonth: "2026-09",
  revenueByMonth: { "2026-06": 1_000_000, "2026-07": 2_000_000, "2026-08": 3_000_000 },
  openedMonth: "2026-06",
});
check("CA-6", "RBT12 proporcional de empresa com 3 meses = média × 12", rbt12New.rbt12Cents, 24_000_000);

const dasMei = computeDasMei({ activity: "SERVICOS", yearRevenueCents: 5_000_000, rates, at: at2026 });
check("CA-7", "DAS-MEI serviços 2026 = R$ 86,05", dasMei.output.amountCents, 8_605);

const presumidoQuarter = computeIrpjCsllPresumido({
  quarterRevenueCents: 30_000_000,
  irpjBaseBps: 3200,
  csllBaseBps: 3200,
  rates,
  at: at2026,
});
check("CA-8", "Presumido trimestre R$ 300 mil: IRPJ R$ 14.400", presumidoQuarter.output.irpjCents, 1_440_000);
check("CA-8", "Adicional de IRPJ R$ 3.600", presumidoQuarter.output.irpjAdditionalCents, 360_000);
check("CA-8", "CSLL R$ 8.640", presumidoQuarter.output.csllCents, 864_000);

const presumidoMonth = computeMonthlyContributions({
  monthRevenueCents: 10_000_000,
  pisCofinsRegime: "CUMULATIVO",
  issRateBps: 500,
  rates,
  at: at2026,
});
check("CA-9", "PIS 0,65% + COFINS 3% + ISS 5% sobre R$ 100 mil", [presumidoMonth.output.pisCents, presumidoMonth.output.cofinsCents, presumidoMonth.output.issCents], [65_000, 300_000, 500_000]);

const pisCofins2027 = computeMonthlyContributions({
  monthRevenueCents: 10_000_000,
  pisCofinsRegime: "CUMULATIVO",
  issRateBps: 0,
  rates,
  at: new Date("2027-03-01T12:00:00Z"),
});
check("CA-9", "PIS/COFINS deixam de existir em 2027", pisCofins2027.output.pisCents + pisCofins2027.output.cofinsCents, 0);

const cbsIbs2026 = computeCbsIbs({ revenueCents: 10_000_000, regime: "PRESUMIDO", rates, at: at2026 });
check("CA-10", "2026: CBS 0,9% e IBS 0,1% destacados", [cbsIbs2026.output.cbsDebitCents, cbsIbs2026.output.ibsDebitCents], [90_000, 10_000]);
check("CA-10", "2026: nada a recolher (ano-teste)", cbsIbs2026.output.totalDueCents, 0);

const cbsIbs2027 = computeCbsIbs({
  revenueCents: 10_000_000,
  regime: "PRESUMIDO",
  cbsCreditsCents: 200_000,
  rates,
  at: new Date("2027-06-01T12:00:00Z"),
});
check("CA-11", "2027: crédito de CBS abate o débito", cbsIbs2027.output.cbsDueCents, cbsIbs2027.output.cbsDebitCents - 200_000);

const cbsReduced = computeCbsIbs({ revenueCents: 10_000_000, reductionBps: 6000, regime: "PRESUMIDO", rates, at: new Date("2027-06-01T12:00:00Z") });
check("CA-11", "Redução de 60% do cClassTrib reduz a base a 40%", cbsReduced.output.cbsDebitCents, Math.round((4_000_000 * 880) / 10000));

const markup = computeMarkupPrice({ unitCostCents: 6_000, taxRateBps: 1000, commissionBps: 500, desiredMarginBps: 2500 });
check("CA-12", "Markup divisor: custo R$ 60 → preço R$ 100", markup.output.priceCents, 10_000);

const effectiveSimples = computeEffectiveRate({
  profile: {
    regime: "SIMPLES",
    simplesAnnex: "III",
    isFatorRSubject: false,
    payroll12mCents: 0,
    presumedIrpjBaseBps: 3200,
    presumedCsllBaseBps: 3200,
    issRateBps: 500,
    ibsCbsOutsideSimples: false,
  },
  rbt12Cents: 30_000_000,
  kind: "SERVICE",
  rates,
  at: at2026,
});
check("CA-13", "Alíquota efetiva para precificar (Simples III, RBT12 R$ 300 mil) = 8,08%", effectiveSimples.output.rateBps, 808);

const late = computeLatePayment({
  principalCents: 100_000,
  dueDate: new Date("2026-08-20T12:00:00Z"),
  paymentDate: new Date("2026-09-10T12:00:00Z"),
  accumulatedSelicBps: 0,
});
check("CA-14", "Atraso de 21 dias: multa 6,93% + juros 1%", [late.output.daysLate, late.output.fineCents, late.output.interestCents], [21, 6_930, 1_000]);

const lateCapped = computeLatePayment({
  principalCents: 100_000,
  dueDate: new Date("2026-01-20T12:00:00Z"),
  paymentDate: new Date("2026-06-20T12:00:00Z"),
  accumulatedSelicBps: 400,
});
check("CA-14", "Multa limitada a 20%", lateCapped.output.fineCents, 20_000);

const proLabore = computeProLabore({ proLaboreCents: 500_000, dependents: 0, rates, at: at2026 });
check("CA-15", "Pró-labore R$ 5.000: INSS R$ 550 e IRRF zerado pelo redutor 2026", [proLabore.output.inssCents, proLabore.output.irrfCents], [55_000, 0]);

const withholdings = computeWithholdings({
  invoiceCents: 1_000_000,
  withholdIrrf: true,
  withholdCsrf: true,
  withholdInss: false,
  issWithheldRateBps: 0,
  rates,
  at: at2026,
});
check("CA-16", "Retenções IRRF 1,5% + CSRF 4,65% em R$ 10 mil", withholdings.output.netReceivableCents, 1_000_000 - 15_000 - 46_500);

console.log("\nContabilidade");

const accounts = { resultAccountId: "expense", counterpartAccountId: "suppliers", cashAccountId: "bank" };
const journal = buildEntryJournal(
  {
    id: "entry",
    type: "PAYABLE",
    status: "PAID",
    description: "Energia",
    amount: 50_000,
    paidAmount: 50_000,
    dueDate: new Date("2026-09-10T12:00:00Z"),
    competenceDate: null,
    paidAt: new Date("2026-09-10T12:00:00Z"),
    costCenterId: null,
  },
  accounts,
);
check("CA-1", "Despesa paga gera reconhecimento + baixa", journal.map((draft) => draft.sourceEvent), ["ACCRUAL", "SETTLEMENT"]);
check("CA-1", "Todos os lançamentos balanceados", journal.every((draft) => isJournalBalanced(draft.lines)), true);

const cancelled = buildEntryJournal(
  { id: "entry", type: "RECEIVABLE", status: "CANCELLED", description: "X", amount: 1000, paidAmount: 0, dueDate: new Date(), competenceDate: null, paidAt: null, costCenterId: null },
  accounts,
);
check("CA-2", "Lançamento cancelado não gera contabilidade", cancelled.length, 0);

console.log("\nNotas fiscais (XML)");

const sampleNfe = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe22260912345678000190550010000012341000012345" versao="4.00">
<ide><nNF>1234</nNF><serie>1</serie><dhEmi>2026-09-10T10:00:00-03:00</dhEmi></ide>
<emit><CNPJ>12345678000190</CNPJ><xNome>Fornecedor Teste</xNome><CRT>3</CRT></emit>
<dest><CNPJ>98765432000110</CNPJ><xNome>Minha Empresa</xNome></dest>
<det nItem="1"><prod><xProd>Notebook</xProd><NCM>84713012</NCM><CFOP>5102</CFOP><vProd>1000.00</vProd></prod>
<imposto><IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib><gIBSCBS><vBC>1000.00</vBC><gIBSUF><vIBSUF>0.50</vIBSUF></gIBSUF><gIBSMun><vIBSMun>0.50</vIBSMun></gIBSMun><gCBS><vCBS>9.00</vCBS></gCBS></gIBSCBS></IBSCBS></imposto></det>
<total><ICMSTot><vICMS>180.00</vICMS><vPIS>16.50</vPIS><vCOFINS>76.00</vCOFINS><vIPI>0.00</vIPI><vNF>1000.00</vNF></ICMSTot>
<IBSCBSTot><vBCIBSCBS>1000.00</vBCIBSCBS><gIBS><vIBS>1.00</vIBS></gIBS><gCBS><vCBS>9.00</vCBS></gCBS></IBSCBSTot></total>
</infNFe></NFe></nfeProc>`;
const parsed = parseFiscalXml(sampleNfe);
check("CA-17", "Chave de acesso de 44 dígitos", parsed.ok ? parsed.document.accessKey.length : 0, 44);
check("CA-17", "IBS R$ 1,00 e CBS R$ 9,00 do grupo IBSCBSTot", parsed.ok ? [parsed.document.taxes.ibsCents, parsed.document.taxes.cbsCents] : null, [100, 900]);
check("CA-17", "Item com NCM e cClassTrib", parsed.ok ? [parsed.document.items[0]?.ncm, parsed.document.items[0]?.cClassTrib] : null, ["84713012", "000001"]);
check("CA-17", "XML inválido não quebra", parseFiscalXml("<nada").ok, false);

console.log("\nRegularidade");

const simplesProfile = { regime: "SIMPLES" as const, hasEmployees: false, isIcmsContributor: false, isIssContributor: true };
const today = new Date("2026-09-29T12:00:00Z");
const applicable = COMPANY_DOCUMENT_TYPES.filter((documentType) => isDocumentApplicable(documentType, simplesProfile));
const allDocuments = applicable
  .filter((documentType) => documentType.recurrence !== "MONTHLY")
  .map((documentType, index) => ({
    id: `doc-${index}`,
    typeCode: documentType.code,
    issuedAt: new Date("2026-09-20T12:00:00Z"),
    expiresAt: null,
    period: null,
    createdAt: new Date("2026-09-20T12:00:00Z"),
    status: "VALID",
  }));
const monthlyTypes = applicable.filter((documentType) => documentType.recurrence === "MONTHLY");
const fulfilled = monthlyTypes.map((documentType) => ({
  typeCode: documentType.code,
  period: "2026-08",
  dueDate: new Date("2026-09-20T12:00:00Z"),
  isFulfilled: true,
}));
const perfectScore = computeRegularityScore({ profile: simplesProfile, overrides: [], documents: allDocuments, monthlyFulfillments: fulfilled, today });
check("CA-18", "Tudo em dia = 100%", perfectScore.scoreBps, 10000);

const oneMonthOpen = computeRegularityScore({
  profile: simplesProfile,
  overrides: [],
  documents: allDocuments,
  monthlyFulfillments: fulfilled.map((fulfillment) => (fulfillment.typeCode === "GUIA_DAS" ? { ...fulfillment, isFulfilled: false } : fulfillment)),
  today,
});
check("CA-19", "Um mês de DAS em aberto derruba o score", oneMonthOpen.scoreBps < 10000, true);
check("CA-19", "Item do DAS fica OVERDUE", oneMonthOpen.items.find((item) => item.typeCode === "GUIA_DAS")?.status, "OVERDUE");

const expired = computeRegularityScore({
  profile: simplesProfile,
  overrides: [],
  documents: allDocuments.map((document) =>
    document.typeCode === "CRF_FGTS" ? { ...document, issuedAt: new Date("2026-07-01T12:00:00Z") } : document,
  ),
  monthlyFulfillments: fulfilled,
  today,
});
check("CA-20", "CRF do FGTS emitido há mais de 30 dias fica vencido", expired.items.find((item) => item.typeCode === "CRF_FGTS")?.status, "EXPIRED");

const missing = computeRegularityScore({ profile: simplesProfile, overrides: [], documents: [], monthlyFulfillments: fulfilled, today });
check("CA-21", "Documento que falta aparece como MISSING", missing.items.find((item) => item.typeCode === "CND_FEDERAL")?.status, "MISSING");

const optOut = computeRegularityScore({
  profile: simplesProfile,
  overrides: [{ typeCode: "CND_FEDERAL", isApplicable: false, weight: null, defaultValidityDays: null }],
  documents: [],
  monthlyFulfillments: fulfilled,
  today,
});
check("CA-21", "Item marcado como não aplicável sai do score", optOut.items.some((item) => item.typeCode === "CND_FEDERAL"), false);

const calendar = buildFiscalCalendar({ profile: simplesProfile, overrides: [], fromMonth: "2026-09", toMonth: "2026-09" });
const dasObligation = calendar.find((obligation) => obligation.kind === "GUIA_DAS");
check("CA-22", "DAS de set/2026 vence em 20/10/2026", dasObligation?.dueDate.toISOString().slice(0, 10), "2026-10-20");

console.log("\nCalculadora e glossário");

check("CA-23", "Toda calculadora roda com campos vazios sem lançar erro", CALCULATORS.every((calculator) => {
  try {
    return runCalculator(calculator.id, {}, { rates, at: at2026 }) !== null;
  } catch (error) {
    console.log(`      ${calculator.id}: ${String(error)}`);
    return false;
  }
}), true);

const referencedTerms = new Set<string>();
for (const calculator of CALCULATORS) {
  for (const field of calculator.fields) if (field.termId) referencedTerms.add(field.termId);
}
for (const documentType of COMPANY_DOCUMENT_TYPES) if (documentType.glossaryTermId) referencedTerms.add(documentType.glossaryTermId);
const missingTerms = [...referencedTerms].filter((termId) => !findGlossaryTerm(termId));
check("CA-24", "Todo termo citado existe no glossário", missingTerms, []);
check("CA-24", "Glossário sem ids duplicados", new Set(GLOSSARY_TERMS.map((glossaryTerm) => glossaryTerm.id)).size, GLOSSARY_TERMS.length);

console.log(`\n${passes} ok, ${failures} falha(s)\n`);
process.exit(failures > 0 ? 1 : 0);
