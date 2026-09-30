import "server-only";

import prisma from "@/lib/prisma";
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  SYSTEM_ACCOUNT_KEYS,
  type SystemAccountKey,
} from "@/features/accounting/lib/chart-of-accounts/default-chart";

const provisionedOrganizations = new Set<string>();

/** Cria o plano padrão da org uma única vez (idempotente por código). */
export async function ensureChartOfAccounts(organizationId: string): Promise<void> {
  if (provisionedOrganizations.has(organizationId)) return;

  const existingCount = await prisma.accountingAccount.count({ where: { organizationId } });
  if (existingCount === 0) {
    await prisma.accountingAccount.createMany({
      data: DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
        organizationId,
        code: account.code,
        name: account.name,
        nature: account.nature,
        isAnalytical: account.isAnalytical,
        systemKey: account.systemKey ?? null,
      })),
      skipDuplicates: true,
    });
  }
  await linkAccountParents(organizationId);

  provisionedOrganizations.add(organizationId);
}

/**
 * Liga cada conta ao pai pelo código (1.1.01.001 → 1.1.01) num único UPDATE.
 * Um update por conta estourava o limite de 5 s da transação no Neon. Também
 * conserta planos que ficaram sem hierarquia por essa falha.
 */
async function linkAccountParents(organizationId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "accounting_accounts" AS child
    SET "parent_id" = parent."id"
    FROM "accounting_accounts" AS parent
    WHERE child."organization_id" = ${organizationId}
      AND parent."organization_id" = ${organizationId}
      AND child."parent_id" IS NULL
      AND position('.' in child."code") > 0
      AND parent."code" = regexp_replace(child."code", '\\.[^.]+$', '')
  `;
}

export type SystemAccountMap = Record<SystemAccountKey, string>;

export async function loadSystemAccounts(organizationId: string): Promise<SystemAccountMap> {
  await ensureChartOfAccounts(organizationId);
  const accounts = await prisma.accountingAccount.findMany({
    where: { organizationId, systemKey: { not: null } },
    select: { id: true, systemKey: true },
  });
  const accountMap = {} as SystemAccountMap;
  for (const account of accounts) {
    if (account.systemKey) accountMap[account.systemKey as SystemAccountKey] = account.id;
  }
  // Conta de sistema apagada à mão: recria para o motor nunca ficar sem destino.
  const missingKeys = Object.values(SYSTEM_ACCOUNT_KEYS).filter((systemKey) => !accountMap[systemKey]);
  for (const systemKey of missingKeys) {
    const template = DEFAULT_CHART_OF_ACCOUNTS.find((account) => account.systemKey === systemKey);
    if (!template) continue;
    const recreated = await prisma.accountingAccount.upsert({
      where: { organizationId_code: { organizationId, code: template.code } },
      create: {
        organizationId,
        code: template.code,
        name: template.name,
        nature: template.nature,
        isAnalytical: true,
        systemKey,
      },
      update: { systemKey },
    });
    accountMap[systemKey] = recreated.id;
  }
  return accountMap;
}

export interface EntryAccountMappings {
  byCategoryId: Map<string, string>;
  byBankAccountId: Map<string, string>;
}

export async function loadAccountMappings(organizationId: string): Promise<EntryAccountMappings> {
  const mappings = await prisma.accountingMapping.findMany({
    where: { organizationId },
    select: { sourceType: true, sourceId: true, accountId: true },
  });
  return {
    byCategoryId: new Map(
      mappings.filter((mapping) => mapping.sourceType === "CATEGORY").map((mapping) => [mapping.sourceId, mapping.accountId]),
    ),
    byBankAccountId: new Map(
      mappings.filter((mapping) => mapping.sourceType === "BANK_ACCOUNT").map((mapping) => [mapping.sourceId, mapping.accountId]),
    ),
  };
}
