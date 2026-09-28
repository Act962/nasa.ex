// Conferência dos critérios de aceite da spec 0009 (seção 8).
// Roda com: pnpm exec tsx scripts/check-projecao-financeira.ts
//
// Sem runner de teste no projeto (deriva do item 20 do CLAUDE.md), este script
// faz as vezes: monta cenários à mão e confere os critérios de aceite contra o
// cálculo puro. Ao mexer em build-projection.ts, rode isto antes de commitar.

import {
  buildProjection,
  type ProjectionEntry,
} from "@/features/payment/server/projection/build-projection";

const HOJE = new Date(2026, 7, 15); // 15/ago/2026
const REAIS = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function entry(over: Partial<ProjectionEntry>): ProjectionEntry {
  return {
    type: "RECEIVABLE",
    status: "PENDING",
    amount: 0,
    paidAmount: 0,
    dueDate: HOJE,
    paidAt: null,
    ...over,
  };
}

/** Gera N meses fechados de histórico pago, para formar média. */
function historico(mesesAtras: number[], entrada: number, saida: number): ProjectionEntry[] {
  const out: ProjectionEntry[] = [];
  for (const offset of mesesAtras) {
    const quando = new Date(HOJE.getFullYear(), HOJE.getMonth() - offset, 10);
    if (entrada > 0)
      out.push(entry({ type: "RECEIVABLE", status: "PAID", amount: entrada, paidAmount: entrada, dueDate: quando, paidAt: quando }));
    if (saida > 0)
      out.push(entry({ type: "PAYABLE", status: "PAID", amount: saida, paidAmount: saida, dueDate: quando, paidAt: quando }));
  }
  return out;
}

let falhas = 0;
function checa(id: string, descricao: string, condicao: boolean, detalhe: string) {
  const marca = condicao ? "PASSOU" : "FALHOU";
  if (!condicao) falhas++;
  console.log(`${marca}  ${id.padEnd(5)} ${descricao}`);
  console.log(`              ${detalhe}\n`);
}

const base = { horizonMonths: 6, trendWindowMonths: 6, today: HOJE };

// ── CA-1: sem lançamentos e sem histórico ────────────────────────────────
{
  const r = buildProjection({ ...base, entries: [], openingBalance: 1_000_000 });
  const todosIguais = r.months.every((m) => m.projectedBalance === 1_000_000);
  checa("CA-1", "Sem movimento: saldo constante e sem base histórica",
    todosIguais && !r.hasTrendBasis,
    `saldos=${r.months.map((m) => REAIS(m.projectedBalance)).join(", ")} | hasTrendBasis=${r.hasTrendBasis}`);
}

// ── CA-2: a receber futuro vira firme ────────────────────────────────────
{
  const proximoMes = new Date(HOJE.getFullYear(), HOJE.getMonth() + 1, 10);
  const r = buildProjection({
    ...base,
    openingBalance: 0,
    entries: [entry({ type: "RECEIVABLE", amount: 500_000, dueDate: proximoMes })],
  });
  const m1 = r.months[1];
  checa("CA-2", "A receber do mês seguinte entra como firme e sobe o saldo",
    m1.committedIn === 500_000 && m1.projectedBalance === 500_000,
    `committedIn=${REAIS(m1.committedIn)} saldo=${REAIS(m1.projectedBalance)}`);
}

// ── CA-3: estimado COMPLETA a média ──────────────────────────────────────
{
  const proximoMes = new Date(HOJE.getFullYear(), HOJE.getMonth() + 1, 10);
  const r = buildProjection({
    ...base,
    openingBalance: 0,
    entries: [
      ...historico([1, 2, 3, 4, 5, 6], 0, 800_000), // saída média 8.000
      entry({ type: "PAYABLE", amount: 300_000, dueDate: proximoMes }),
    ],
  });
  const m1 = r.months[1];
  checa("CA-3", "Firme 3.000 + média 8.000 => estimado 5.000 (não 11.000)",
    m1.committedOut === 300_000 && m1.estimatedOut === 500_000,
    `média=${REAIS(r.monthlyAverageOut)} firme=${REAIS(m1.committedOut)} estimado=${REAIS(m1.estimatedOut)}`);
}

// ── CA-4: firme acima da média não é reduzido ────────────────────────────
{
  const proximoMes = new Date(HOJE.getFullYear(), HOJE.getMonth() + 1, 10);
  const r = buildProjection({
    ...base,
    openingBalance: 0,
    entries: [
      ...historico([1, 2, 3, 4, 5, 6], 0, 800_000),
      entry({ type: "PAYABLE", amount: 1_200_000, dueDate: proximoMes }),
    ],
  });
  const m1 = r.months[1];
  checa("CA-4", "Firme 12.000 acima da média 8.000 => estimado 0, firme intacto",
    m1.committedOut === 1_200_000 && m1.estimatedOut === 0,
    `firme=${REAIS(m1.committedOut)} estimado=${REAIS(m1.estimatedOut)} confiança=${(m1.confidence * 100).toFixed(0)}%`);
}

// ── CA-5: vencido vai pro primeiro mês ───────────────────────────────────
{
  const quarentaDiasAtras = new Date(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate() - 40);
  const r = buildProjection({
    ...base,
    openingBalance: 0,
    entries: [entry({ type: "PAYABLE", status: "OVERDUE", amount: 250_000, dueDate: quarentaDiasAtras })],
  });
  checa("CA-5", "Vencido há 40 dias entra no mês 1, não some",
    r.months[0].overdueOut === 250_000 && r.months[0].committedOut === 250_000 && r.overdueOut === 250_000,
    `mês1.overdueOut=${REAIS(r.months[0].overdueOut)} mês1.committedOut=${REAIS(r.months[0].committedOut)}`);
}

// ── CA-6: PAID futuro não afeta nada ─────────────────────────────────────
{
  const proximoMes = new Date(HOJE.getFullYear(), HOJE.getMonth() + 1, 10);
  const r = buildProjection({
    ...base,
    openingBalance: 1_000_000,
    entries: [entry({ type: "RECEIVABLE", status: "PAID", amount: 900_000, paidAmount: 900_000, dueDate: proximoMes, paidAt: proximoMes })],
  });
  const semEfeito = r.months.every((m) => m.projectedBalance === 1_000_000);
  checa("CA-6", "Lançamento PAID com vencimento futuro não move a projeção",
    semEfeito,
    `saldos=${r.months.map((m) => REAIS(m.projectedBalance)).join(", ")}`);
}

// ── CA-7: PARTIAL projeta só o saldo devedor ─────────────────────────────
{
  const proximoMes = new Date(HOJE.getFullYear(), HOJE.getMonth() + 1, 10);
  const r = buildProjection({
    ...base,
    openingBalance: 0,
    entries: [entry({ type: "RECEIVABLE", status: "PARTIAL", amount: 100_000, paidAmount: 40_000, dueDate: proximoMes })],
  });
  checa("CA-7", "PARTIAL de 1.000 com 400 pagos projeta 600",
    r.months[1].committedIn === 60_000,
    `committedIn=${REAIS(r.months[1].committedIn)}`);
}

// ── CB-2: histórico curto desliga a estimativa ───────────────────────────
{
  const r = buildProjection({
    ...base,
    openingBalance: 0,
    trendWindowMonths: 1,
    entries: historico([1], 500_000, 200_000),
  });
  checa("CB-2", "Só 1 mês fechado => sem base histórica, estimativa desligada",
    !r.hasTrendBasis && r.months.every((m) => m.estimatedIn === 0 && m.estimatedOut === 0),
    `hasTrendBasis=${r.hasTrendBasis} trendMonthsUsed=${r.trendMonthsUsed}`);
}

// ── CB-5: PENDING_APPROVAL conta como firme ──────────────────────────────
{
  const proximoMes = new Date(HOJE.getFullYear(), HOJE.getMonth() + 1, 10);
  const r = buildProjection({
    ...base,
    openingBalance: 0,
    entries: [entry({ type: "PAYABLE", status: "PENDING_APPROVAL", amount: 700_000, dueDate: proximoMes })],
  });
  checa("CB-5", "PENDING_APPROVAL conta como compromisso firme",
    r.months[1].committedOut === 700_000,
    `committedOut=${REAIS(r.months[1].committedOut)}`);
}

// ── CB-6: CANCELLED fora ─────────────────────────────────────────────────
{
  const proximoMes = new Date(HOJE.getFullYear(), HOJE.getMonth() + 1, 10);
  const r = buildProjection({
    ...base,
    openingBalance: 0,
    entries: [entry({ type: "PAYABLE", status: "CANCELLED", amount: 700_000, dueDate: proximoMes })],
  });
  checa("CB-6", "CANCELLED não entra na projeção",
    r.months[1].committedOut === 0,
    `committedOut=${REAIS(r.months[1].committedOut)}`);
}

// ── CB-9: horizonte cruzando o ano rotula com o ano ──────────────────────
{
  const r = buildProjection({
    entries: [], openingBalance: 0, horizonMonths: 12, trendWindowMonths: 6, today: HOJE,
  });
  checa("CB-9", "Horizonte de 12 meses cruza o ano => rótulo inclui o ano",
    r.months.every((m) => m.label.includes("/")),
    `rótulos=${r.months.map((m) => m.label).join(" ")}`);
}

// ── Cenário realista de ponta a ponta ────────────────────────────────────
{
  const mes = (offset: number, dia = 10) => new Date(HOJE.getFullYear(), HOJE.getMonth() + offset, dia);
  const r = buildProjection({
    ...base,
    openingBalance: 1_500_000, // 15.000 em caixa
    entries: [
      ...historico([1, 2, 3, 4, 5, 6], 1_000_000, 700_000), // entra 10k, sai 7k
      entry({ type: "RECEIVABLE", amount: 400_000, dueDate: mes(1) }),
      entry({ type: "PAYABLE", amount: 900_000, dueDate: mes(1) }),
      entry({ type: "PAYABLE", amount: 2_500_000, dueDate: mes(3) }), // compra grande
      entry({ type: "PAYABLE", status: "OVERDUE", amount: 300_000, dueDate: mes(-2) }),
    ],
  });
  console.log("── Cenário de ponta a ponta ─────────────────────────────────");
  console.log(`saldo inicial: ${REAIS(r.openingBalance)} | média entrada ${REAIS(r.monthlyAverageIn)} / saída ${REAIS(r.monthlyAverageOut)}`);
  console.log(`vencido em aberto: ${REAIS(r.overdueOut)} (saída)\n`);
  console.log("mês    firme+     firme-     estim+     estim-     saldo          confiança");
  for (const m of r.months) {
    console.log(
      m.label.padEnd(7) +
      REAIS(m.committedIn).padStart(10) + " " +
      REAIS(m.committedOut).padStart(10) + " " +
      REAIS(m.estimatedIn).padStart(10) + " " +
      REAIS(m.estimatedOut).padStart(10) + " " +
      REAIS(m.projectedBalance).padStart(14) + "   " +
      `${(m.confidence * 100).toFixed(0)}%`,
    );
  }
  const temNegativo = r.months.some((m) => m.projectedBalance < 0);
  console.log(`\nalgum mês negativo? ${temNegativo ? "sim — a tela destaca (CA-8)" : "não"}`);
}

console.log(`\n${falhas === 0 ? "TODOS OS CRITÉRIOS PASSARAM" : `### ${falhas} FALHA(S) ###`}`);
process.exit(falhas === 0 ? 0 : 1);
