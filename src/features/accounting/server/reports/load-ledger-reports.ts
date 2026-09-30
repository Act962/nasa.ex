import "server-only";

import prisma from "@/lib/prisma";
import { isDebitNature, type AccountingNatureCode } from "@/features/accounting/lib/chart-of-accounts/default-chart";
import { ensureChartOfAccounts } from "@/features/accounting/server/chart/chart-of-accounts";

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  nature: AccountingNatureCode;
  isAnalytical: boolean;
  openingCents: number;
  debitCents: number;
  creditCents: number;
  closingCents: number;
}

/**
 * Balancete: saldo anterior, movimento e saldo final por conta. Saldo sempre
 * no sentido natural da conta (devedora ou credora), então positivo = normal.
 * Contas sintéticas somam as filhas pelo prefixo do código.
 */
export async function loadTrialBalance(params: { organizationId: string; from: Date; to: Date }) {
  await ensureChartOfAccounts(params.organizationId);
  const accounts = await prisma.accountingAccount.findMany({
    where: { organizationId: params.organizationId, isActive: true },
    orderBy: { code: "asc" },
  });

  const [openingSums, periodSums] = await Promise.all([
    prisma.journalLine.groupBy({
      by: ["accountId"],
      where: { organizationId: params.organizationId, journalEntry: { date: { lt: params.from } } },
      _sum: { debitCents: true, creditCents: true },
    }),
    prisma.journalLine.groupBy({
      by: ["accountId"],
      where: { organizationId: params.organizationId, journalEntry: { date: { gte: params.from, lte: params.to } } },
      _sum: { debitCents: true, creditCents: true },
    }),
  ]);
  const openingByAccount = new Map(openingSums.map((sum) => [sum.accountId, sum._sum]));
  const periodByAccount = new Map(periodSums.map((sum) => [sum.accountId, sum._sum]));

  const analyticalRows: TrialBalanceRow[] = accounts.map((account) => {
    const opening = openingByAccount.get(account.id);
    const period = periodByAccount.get(account.id);
    const sign = isDebitNature(account.nature) ? 1 : -1;
    const openingCents = sign * ((opening?.debitCents ?? 0) - (opening?.creditCents ?? 0));
    const debitCents = period?.debitCents ?? 0;
    const creditCents = period?.creditCents ?? 0;
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      nature: account.nature,
      isAnalytical: account.isAnalytical,
      openingCents,
      debitCents,
      creditCents,
      closingCents: openingCents + sign * (debitCents - creditCents),
    };
  });

  const rows = analyticalRows.map((row) => {
    if (row.isAnalytical) return row;
    const children = analyticalRows.filter(
      (candidate) => candidate.isAnalytical && candidate.code.startsWith(`${row.code}.`),
    );
    return {
      ...row,
      openingCents: children.reduce((total, child) => total + child.openingCents, 0),
      debitCents: children.reduce((total, child) => total + child.debitCents, 0),
      creditCents: children.reduce((total, child) => total + child.creditCents, 0),
      closingCents: children.reduce((total, child) => total + child.closingCents, 0),
    };
  });

  const totalDebitCents = analyticalRows.reduce((total, row) => total + row.debitCents, 0);
  const totalCreditCents = analyticalRows.reduce((total, row) => total + row.creditCents, 0);
  return { rows, totalDebitCents, totalCreditCents, isBalanced: totalDebitCents === totalCreditCents };
}

export async function loadLedger(params: { organizationId: string; accountId: string; from: Date; to: Date }) {
  const account = await prisma.accountingAccount.findFirst({
    where: { id: params.accountId, organizationId: params.organizationId },
  });
  if (!account) return null;
  const sign = isDebitNature(account.nature) ? 1 : -1;

  const opening = await prisma.journalLine.aggregate({
    where: { organizationId: params.organizationId, accountId: account.id, journalEntry: { date: { lt: params.from } } },
    _sum: { debitCents: true, creditCents: true },
  });
  let runningCents = sign * ((opening._sum.debitCents ?? 0) - (opening._sum.creditCents ?? 0));
  const openingCents = runningCents;

  const lines = await prisma.journalLine.findMany({
    where: {
      organizationId: params.organizationId,
      accountId: account.id,
      journalEntry: { date: { gte: params.from, lte: params.to } },
    },
    include: { journalEntry: { select: { date: true, description: true, sourceType: true, sourceId: true, sourceEvent: true } } },
    orderBy: [{ journalEntry: { date: "asc" } }, { id: "asc" }],
    take: 1000,
  });

  const movements = lines.map((line) => {
    runningCents += sign * (line.debitCents - line.creditCents);
    return {
      id: line.id,
      date: line.journalEntry.date,
      description: line.journalEntry.description,
      sourceType: line.journalEntry.sourceType,
      sourceId: line.journalEntry.sourceId,
      sourceEvent: line.journalEntry.sourceEvent,
      debitCents: line.debitCents,
      creditCents: line.creditCents,
      balanceCents: runningCents,
    };
  });

  return {
    account: { id: account.id, code: account.code, name: account.name, nature: account.nature },
    openingCents,
    closingCents: runningCents,
    movements,
  };
}

/** Balanço numa data: ativo = passivo + PL + resultado do exercício. */
export async function loadBalanceSheet(params: { organizationId: string; at: Date }) {
  const trial = await loadTrialBalance({
    organizationId: params.organizationId,
    from: new Date(Date.UTC(1970, 0, 1)),
    to: params.at,
  });
  const analytical = trial.rows.filter((row) => row.isAnalytical);
  const sumNature = (nature: AccountingNatureCode) =>
    analytical.filter((row) => row.nature === nature).reduce((total, row) => total + row.closingCents, 0);

  const assetsCents = sumNature("ASSET");
  const liabilitiesCents = sumNature("LIABILITY");
  const equityCents = sumNature("EQUITY");
  const resultCents = sumNature("REVENUE") - sumNature("COST") - sumNature("EXPENSE");

  const pickRows = (nature: AccountingNatureCode) =>
    analytical
      .filter((row) => row.nature === nature && row.closingCents !== 0)
      .map((row) => ({ code: row.code, name: row.name, amountCents: row.closingCents }));

  return {
    at: params.at,
    assets: { totalCents: assetsCents, rows: pickRows("ASSET") },
    liabilities: { totalCents: liabilitiesCents, rows: pickRows("LIABILITY") },
    equity: { totalCents: equityCents + resultCents, rows: pickRows("EQUITY"), periodResultCents: resultCents },
    isBalanced: assetsCents === liabilitiesCents + equityCents + resultCents,
  };
}
