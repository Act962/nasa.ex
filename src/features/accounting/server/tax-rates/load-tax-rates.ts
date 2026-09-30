import "server-only";

import prisma from "@/lib/prisma";
import { DEFAULT_TAX_RATES, DEFAULT_TAX_RATES_VERSION } from "@/features/accounting/lib/tax/seed/default-tax-rates";
import type { TaxRateRow } from "@/features/accounting/lib/tax/types";

// As tabelas globais são provisionadas sob demanda (upsert por seedKey), na
// primeira leitura do processo. Evita depender de alguém rodar seed em cada
// ambiente e nunca duplica linha.

let provisioningPromise: Promise<void> | null = null;
let provisionedVersion: string | null = null;

export async function ensureDefaultTaxRates(): Promise<void> {
  if (provisionedVersion === DEFAULT_TAX_RATES_VERSION) return;
  if (!provisioningPromise) {
    provisioningPromise = provisionDefaultTaxRates()
      .then(() => {
        provisionedVersion = DEFAULT_TAX_RATES_VERSION;
      })
      .finally(() => {
        provisioningPromise = null;
      });
  }
  await provisioningPromise;
}

async function provisionDefaultTaxRates() {
  const existing = await prisma.taxRate.findMany({
    where: { seedKey: { in: DEFAULT_TAX_RATES.map((seed) => seed.seedKey) } },
    select: { seedKey: true },
  });
  const existingKeys = new Set(existing.map((row) => row.seedKey));
  const missing = DEFAULT_TAX_RATES.filter((seed) => !existingKeys.has(seed.seedKey));
  if (missing.length === 0) return;

  await prisma.taxRate.createMany({
    data: missing.map((seed) => ({
      seedKey: seed.seedKey,
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
      reductionBps: seed.reductionBps,
      validFrom: new Date(`${seed.validFrom}T00:00:00Z`),
      validTo: seed.validTo ? new Date(`${seed.validTo}T23:59:59Z`) : null,
      legalSource: seed.legalSource,
      note: seed.note,
    })),
    skipDuplicates: true,
  });
}

/** Tabelas globais + sobrescritas da org (ex.: ISS do município). */
export async function loadTaxRates(organizationId: string): Promise<TaxRateRow[]> {
  await ensureDefaultTaxRates();
  const rows = await prisma.taxRate.findMany({
    where: { OR: [{ organizationId: null }, { organizationId }] },
  });
  return rows.map((row) => ({
    tax: row.tax,
    regime: row.regime,
    annex: row.annex,
    bracket: row.bracket,
    revenueFromCents: row.revenueFromCents,
    revenueToCents: row.revenueToCents,
    rateBps: row.rateBps,
    deductionCents: row.deductionCents,
    fixedAmountCents: row.fixedAmountCents,
    municipioIbge: row.municipioIbge,
    cClassTrib: row.cClassTrib,
    reductionBps: row.reductionBps,
    validFrom: row.validFrom,
    validTo: row.validTo,
    legalSource: row.legalSource,
    note: row.note,
  }));
}
