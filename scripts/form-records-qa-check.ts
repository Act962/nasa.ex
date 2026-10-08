/**
 * Critérios de aceite da spec 0075 que não dependem de banco: valores dos
 * blocos novos, preço no servidor, cálculo, projeção da ficha e rateio.
 *
 *   pnpm tsx scripts/form-records-qa-check.ts
 */
import { allocateSharedCost } from "../src/features/form-records/lib/allocate-shared-cost";
import { computeCalculations } from "../src/features/form-records/lib/calculation";
import { computeClosing, lastDayOfPeriod, parseSharedCostGroups } from "../src/features/form-records/lib/compute-closing";
import { buildImageMarkersValue, parseImageMarkers } from "../src/features/form-records/lib/image-markers-value";
import { parseItemListMeta, priceItemLists } from "../src/features/form-records/lib/item-list-value";
import { convertMeasure, formatMeasure, parseDecimalInput } from "../src/features/form-records/lib/measure-units";
import { buildNumberMeasureValue } from "../src/features/form-records/lib/number-measure-value";
import {
  buildOrbitLookupValue,
  filterInlineOptions,
  parseInlineOptions,
  parseOrbitLookupMeta,
} from "../src/features/form-records/lib/orbit-lookup-value";
import { buildRecordProjection, toFieldKey, toPeriodKey } from "../src/features/form-records/lib/record-fields";
import { flattenBlocks, parseResponse } from "../src/features/form-records/lib/response-values";

let failures = 0;

function check(id: string, passed: boolean, detail: string): void {
  console.log(`[${passed ? "PASS" : "FAIL"}] ${id} — ${detail}`);
  if (!passed) failures += 1;
}

// ── CA-1 — número com medida ───────────────────────────────────────────────
check("CA-1 lê número brasileiro", parseDecimalInput("1.250,50") === 1250.5 && parseDecimalInput("R$ 12") === 12, "1.250,50 e R$ 12");
check("CA-1 texto não é número", parseDecimalInput("abc") === null, "abc");
const currencyValue = buildNumberMeasureValue({ rawText: "1.250,5", unitId: "brl" });
check("CA-1 moeda formatada", currencyValue.value.replace(/\s/g, " ") === "R$ 1.250,50" && currencyValue.meta?.amount === 1250.5, currencyValue.value);
const customValue = buildNumberMeasureValue({ rawText: "3", unitId: "custom", customUnit: "demãos" });
check("CA-1 unidade personalizada", customValue.value === "3 demãos" && customValue.meta?.unit === "demãos", customValue.value);
check("CA-1 vazio emite value vazio", buildNumberMeasureValue({ rawText: "", unitId: "ml" }).value === "", "campo vazio");
check("CA-1 converte ml para L", convertMeasure(1500, "ml", "l") === 1.5 && convertMeasure(2, "kg", "g") === 2000, "1500 ml = 1,5 L");
check("CA-1 não converte famílias diferentes", convertMeasure(1, "ml", "kg") === null, "ml → kg");
check("CA-1 formata medida", formatMeasure(12.5, "l") === "12,5 L", formatMeasure(12.5, "l"));

// ── CA-2 — lista de itens com preço do servidor ────────────────────────────
const formBlocks = flattenBlocks(
  JSON.stringify([
    {
      id: "row",
      blockType: "RowLayout",
      childblocks: [
        { id: "os", blockType: "TextField", attributes: { label: "Nº O.S.", fieldKey: "os", isSearchable: true, showInList: true } },
        { id: "plate", blockType: "TextField", attributes: { label: "Placa", fieldKey: "placa", isSearchable: true, showInList: true } },
        { id: "date", blockType: "DatePicker", attributes: { label: "Data", useAsReferenceDate: true } },
        { id: "service", blockType: "NumberMeasure", attributes: { label: "Valor do serviço", unitId: "brl" } },
        {
          id: "items",
          blockType: "ItemList",
          attributes: {
            items: [
              { itemId: "lixa80", productId: "prod-lixa80", name: "Lixa seco P80", unit: "un", billingMode: "USAGE" },
              { itemId: "disco150", productId: "prod-disco150", name: "Disco seco P150", unit: "un", billingMode: "USAGE" },
              { itemId: "verniz", productId: "prod-verniz", name: "Verniz PU", unit: "ml", billingMode: "INFO" },
              { itemId: "avulso", productId: null, name: "Item sem catálogo", unit: "un", billingMode: "USAGE" },
            ],
          },
        },
        { id: "total", blockType: "Calculation", attributes: { operation: "SUM", sourceBlockIds: ["items", "service"], resultUnit: "brl" } },
      ],
    },
  ]),
);
const catalogPrices = new Map([
  ["prod-lixa80", 330],
  ["prod-disco150", 715],
  ["prod-verniz", 19],
]);
const submitted = parseResponse(
  JSON.stringify({
    os: { value: "00123" },
    plate: { value: "ABC1D23" },
    date: { value: "2026-09-30", meta: { iso: "2026-09-30" } },
    service: buildNumberMeasureValue({ rawText: "500", unitId: "brl" }),
    items: {
      value: "adulterado",
      meta: {
        kind: "item-list",
        items: [
          { itemId: "lixa80", quantity: 2, unitPriceCents: 1, name: "Nome trocado", billingMode: "INFO" },
          { itemId: "disco150", quantity: 1 },
          { itemId: "verniz", quantity: 300 },
          { itemId: "avulso", quantity: 4 },
          { itemId: "fantasma", quantity: 9, unitPriceCents: 99999 },
        ],
      },
    },
  }),
);
const priced = priceItemLists({ blocks: formBlocks, response: submitted, priceCentsByProductId: catalogPrices });
const pricedMeta = parseItemListMeta(priced.items.meta);
const lixa = pricedMeta?.items.find((item) => item.itemId === "lixa80");
check("CA-2 preço vem do catálogo, não do navegador", lixa?.unitPriceCents === 330 && lixa.name === "Lixa seco P80" && lixa.billingMode === "USAGE", JSON.stringify(lixa));
check("CA-2 item fora do formulário é ignorado", !pricedMeta?.items.some((item) => item.itemId === "fantasma"), "fantasma descartado");
check("CA-2 total só dos itens cobrados pelo uso", pricedMeta?.usageTotalCents === 2 * 330 + 715, String(pricedMeta?.usageTotalCents));
check("CA-2 item sem preço entra sem valor", pricedMeta?.items.find((item) => item.itemId === "avulso")?.unitPriceCents === null, "avulso sem preço");
check("CA-2 resumo em texto", priced.items.value.replace(/\s/g, " ") === "4 itens · R$ 13,75", priced.items.value);

const repriced = priceItemLists({
  blocks: formBlocks,
  response: submitted,
  previousResponse: priced,
  priceCentsByProductId: new Map([["prod-lixa80", 999], ["prod-disco150", 999], ["prod-verniz", 999]]),
});
check("CA-3 edição mantém o preço da ficha", parseItemListMeta(repriced.items.meta)?.usageTotalCents === 2 * 330 + 715, "catálogo mudou, ficha não");
const emptied = priceItemLists({ blocks: formBlocks, response: parseResponse({ items: { value: "x", meta: { kind: "item-list", items: [] } } }), priceCentsByProductId: catalogPrices });
check("CA-2 lista vazia emite value vazio", emptied.items.value === "", "obrigatório não passa em branco");

// ── CA-4 — cálculo ─────────────────────────────────────────────────────────
const calculated = computeCalculations({ blocks: formBlocks, response: priced });
check("CA-4 soma itens + valor do serviço", calculated.total.meta?.amount === 513.75, String(calculated.total.meta?.amount));
check("CA-4 resultado formatado em reais", calculated.total.value.replace(/\s/g, " ") === "R$ 513,75", calculated.total.value);

// ── CA-5 — marcar na imagem ────────────────────────────────────────────────
const markers = parseImageMarkers({
  kind: "image-markers",
  markers: [
    { id: "a", xPercent: 12.345, yPercent: 150, note: "  Capô " },
    { id: "b", xPercent: "x", yPercent: 10 },
  ],
});
check("CA-5 marcador inválido é descartado e posição é limitada", markers.length === 1 && markers[0].yPercent === 100 && markers[0].note === "Capô", JSON.stringify(markers));
check("CA-5 resumo e vazio", buildImageMarkersValue(markers).value === "1 marcação: Capô" && buildImageMarkersValue([]).value === "", buildImageMarkersValue(markers).value);

// ── CA-6 — projeção da ficha ───────────────────────────────────────────────
const projection = buildRecordProjection({ blocks: formBlocks, response: calculated });
check("CA-6 campos-chave e busca", projection.keyFields.placa?.value === "ABC1D23" && projection.searchText === "00123 abc1d23", projection.searchText);
check("CA-6 total e itens de uso", projection.usageTotalCents === 1375 && projection.usageItems.length === 3, String(projection.usageTotalCents));
check("CA-6 período vem da data da ficha", projection.referenceDate !== null && toPeriodKey(projection.referenceDate) === "2026-09", String(projection.referenceDate));
check("CA-6 nome-chave digitado vira slug", toFieldKey("Placa do Veículo") === "placa_do_veiculo", toFieldKey("Placa do Veículo"));

// ── CA-12 — busca no Órbita ────────────────────────────────────────────────
const pastedList = parseInlineOptions("Fiat Argo\nFiat Mobi\n\nfiat argo\tJeep Compass;Citroën C3");
check("CA-12 lista colada vira itens únicos", pastedList.join("|") === "Fiat Argo|Fiat Mobi|Jeep Compass|Citroën C3", pastedList.join("|"));
check("CA-12 filtro ignora acento e ordem", filterInlineOptions(pastedList, "c3 citroen").join("|") === "Citroën C3", filterInlineOptions(pastedList, "c3 citroen").join("|"));
const typedLookup = buildOrbitLookupValue({ text: "  Modelo raro  ", source: "INLINE", refId: null });
check("CA-12 texto digitado à mão vale", typedLookup.value === "Modelo raro" && parseOrbitLookupMeta(typedLookup.meta)?.refId === null, JSON.stringify(typedLookup));
const pickedLookup = buildOrbitLookupValue({ text: "00123", source: "RECORDS", refId: "rec_1" });
check("CA-12 ficha escolhida guarda a origem", parseOrbitLookupMeta(pickedLookup.meta)?.refId === "rec_1", JSON.stringify(pickedLookup.meta));
check("CA-12 vazio emite value vazio", buildOrbitLookupValue({ text: " ", source: "LEADS", refId: null }).value === "", "campo vazio");

// ── CA-9 — rateio ──────────────────────────────────────────────────────────
// Setembro da oficina (planilha): 15 concessionárias, 69 veículos.
const vehiclesByClient: [string, number][] = [
  ["jelta-frei", 10], ["jelta-joao-xiii", 14], ["united-car", 9], ["green-city", 8], ["jelta-car", 9],
  ["riviera", 1], ["locadora-matilde", 2], ["jelta-veiculos", 2], ["jelta-automove", 1], ["jelta-drive", 5],
  ["shenzhen", 3], ["jelta-locadora", 2], ["jelta-corretora", 1], ["jelta-seminovos", 1], ["trilha-veiculos", 1],
];
const shares = vehiclesByClient.map(([key, weight]) => ({ key, weight }));
const SUPPLIES_CENTS = 1_354_049;
const PAINTS_CENTS = 715_469;
const ABRASIVES_CENTS = 300_642;
const supplies = allocateSharedCost(SUPPLIES_CENTS, shares);
const paints = allocateSharedCost(PAINTS_CENTS, shares);
const sumOf = (allocation: Map<string, number>) => [...allocation.values()].reduce((total, cents) => total + cents, 0);
check("CA-9 69 veículos na planilha", shares.reduce((total, share) => total + share.weight, 0) === 69, "soma dos veículos");
check("CA-9 rateio de insumos fecha no centavo", sumOf(supplies) === SUPPLIES_CENTS, String(sumOf(supplies)));
check("CA-9 rateio de tintas fecha no centavo", sumOf(paints) === PAINTS_CENTS, String(sumOf(paints)));
check("CA-9 parte de quem tem 10 veículos", supplies.get("jelta-frei") === 196_239, String(supplies.get("jelta-frei")));
check("CA-9 total de setembro bate com a planilha", SUPPLIES_CENTS + PAINTS_CENTS + ABRASIVES_CENTS === 2_370_160, "R$ 23.701,60");
const withIdle = allocateSharedCost(1000, [{ key: "a", weight: 1 }, { key: "b", weight: 0 }, { key: "c", weight: 2 }]);
check("CA-9 cliente sem ficha não recebe rateio", withIdle.get("b") === 0 && sumOf(withIdle) === 1000, JSON.stringify([...withIdle]));
check("CA-9 sem fichas não divide", sumOf(allocateSharedCost(1000, [])) === 0, "zero fichas");

// ── CA-10 — fechamento por cliente ─────────────────────────────────────────
const septemberGroups = parseSharedCostGroups([
  { id: "insumos", name: "Insumos", lines: [{ id: "l1", description: "Verniz", quantity: 16, unit: "un", totalCents: SUPPLIES_CENTS }] },
  { id: "tintas", name: "Tintas produzidas", lines: [{ id: "l2", description: "Tintas do mês", quantity: 1, unit: "un", totalCents: PAINTS_CENTS, date: "2026-09-30" }] },
  { id: 7, name: "grupo inválido" },
]);
check("CA-10 grupo malformado é descartado", septemberGroups.length === 2, String(septemberGroups.length));
// Abrasivos distribuídos de forma arbitrária entre as fichas; só o total importa aqui.
const septemberRecords = vehiclesByClient.flatMap(([leadId, vehicleCount], clientIndex) =>
  Array.from({ length: vehicleCount }, (_unused, vehicleIndex) => ({
    leadId,
    usageTotalCents: clientIndex === 0 && vehicleIndex === 0 ? ABRASIVES_CENTS : 0,
    isFinalized: true,
  })),
);
const closing = computeClosing({
  records: [...septemberRecords, { leadId: "jelta-frei", usageTotalCents: 9999, isFinalized: false }, { leadId: null, usageTotalCents: 500, isFinalized: true }],
  groups: septemberGroups,
  leadNameById: new Map(vehiclesByClient.map(([leadId]) => [leadId, leadId])),
});
check("CA-10 15 clientes e 69 fichas", closing.lines.length === 15 && closing.totalRecords === 69, `${closing.lines.length} clientes, ${closing.totalRecords} fichas`);
check("CA-10 total de setembro", closing.totalCents === 2_370_160, String(closing.totalCents));
check("CA-10 soma das linhas fecha com o total", closing.lines.reduce((total, line) => total + line.totalCents, 0) === closing.totalCents, "linhas = total");
check("CA-10 rascunho e ficha sem cliente ficam de fora e são avisados", closing.draftCount === 1 && closing.withoutClientCount === 1, `${closing.draftCount} rascunho, ${closing.withoutClientCount} sem cliente`);
const jeltaFrei = closing.lines.find((line) => line.leadId === "jelta-frei");
check("CA-10 linha do cliente com 10 fichas", jeltaFrei?.recordCount === 10 && jeltaFrei.shares[0].cents === 196_239 && jeltaFrei.usageCents === ABRASIVES_CENTS, JSON.stringify(jeltaFrei?.shares));
check("CA-10 vencimento é o último dia do período", lastDayOfPeriod("2026-09") === "2026-09-30" && lastDayOfPeriod("2028-02") === "2028-02-29", lastDayOfPeriod("2026-09"));
const emptyClosing = computeClosing({ records: [], groups: septemberGroups, leadNameById: new Map() });
check("CA-10 período sem fichas não gera linha", emptyClosing.lines.length === 0 && emptyClosing.totalCents === 0, "vazio");

console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
process.exit(failures === 0 ? 0 : 1);
