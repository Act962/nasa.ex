import { z } from "zod";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { ensureChartOfAccounts } from "@/features/accounting/server/chart/chart-of-accounts";
import {
  loadBalanceSheet,
  loadLedger,
  loadTrialBalance,
} from "@/features/accounting/server/reports/load-ledger-reports";
import { resolveParentCode } from "@/features/accounting/lib/chart-of-accounts/default-chart";
import { accountingReadProcedure, accountingWriteProcedure } from "./procedures";

const natureSchema = z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COST", "EXPENSE"]);
const periodInput = z.object({ from: z.string(), to: z.string() });

function parseRange(input: { from: string; to: string }) {
  return {
    from: new Date(`${input.from.slice(0, 10)}T00:00:00Z`),
    to: new Date(`${input.to.slice(0, 10)}T23:59:59Z`),
  };
}

export const listAccountingAccounts = accountingReadProcedure
  .route({ method: "GET", summary: "Plano de contas", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      accounts: z.array(
        z.object({
          id: z.string(),
          code: z.string(),
          name: z.string(),
          nature: natureSchema,
          parentId: z.string().nullable(),
          isAnalytical: z.boolean(),
          systemKey: z.string().nullable(),
          referentialCode: z.string().nullable(),
          isActive: z.boolean(),
        }),
      ),
      mappings: z.array(z.object({ sourceType: z.string(), sourceId: z.string(), accountId: z.string() })),
    }),
  )
  .handler(async ({ context }) => {
    await ensureChartOfAccounts(context.org.id);
    const [accounts, mappings] = await Promise.all([
      prisma.accountingAccount.findMany({ where: { organizationId: context.org.id }, orderBy: { code: "asc" } }),
      prisma.accountingMapping.findMany({
        where: { organizationId: context.org.id },
        select: { sourceType: true, sourceId: true, accountId: true },
      }),
    ]);
    return { accounts, mappings };
  });

export const createAccountingAccount = accountingWriteProcedure
  .route({ method: "POST", summary: "Cria conta contábil", tags: ["Accounting"] })
  .input(
    z.object({
      code: z.string().regex(/^\d+(\.\d+)*$/).max(30),
      name: z.string().min(2).max(120),
      nature: natureSchema,
      isAnalytical: z.boolean().default(true),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const duplicate = await prisma.accountingAccount.findUnique({
      where: { organizationId_code: { organizationId: context.org.id, code: input.code } },
      select: { id: true },
    });
    if (duplicate) throw errors.BAD_REQUEST({ message: "Já existe uma conta com esse código." });
    const parentCode = resolveParentCode(input.code);
    const parent = parentCode
      ? await prisma.accountingAccount.findUnique({
          where: { organizationId_code: { organizationId: context.org.id, code: parentCode } },
          select: { id: true },
        })
      : null;
    const created = await prisma.accountingAccount.create({
      data: { organizationId: context.org.id, ...input, parentId: parent?.id ?? null },
      select: { id: true },
    });
    return created;
  });

export const updateAccountingAccount = accountingWriteProcedure
  .route({ method: "PATCH", summary: "Edita conta contábil", tags: ["Accounting"] })
  .input(z.object({ accountId: z.string(), name: z.string().min(2).max(120).optional(), isActive: z.boolean().optional(), referentialCode: z.string().max(40).nullable().optional() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const { accountId, ...data } = input;
    const account = await prisma.accountingAccount.findFirst({
      where: { id: accountId, organizationId: context.org.id },
      select: { systemKey: true },
    });
    if (!account) throw errors.NOT_FOUND({ message: "Conta não encontrada" });
    if (account.systemKey && data.isActive === false) {
      throw errors.BAD_REQUEST({ message: "Conta usada pelo sistema não pode ser desativada." });
    }
    await prisma.accountingAccount.update({ where: { id: accountId }, data });
    return { ok: true as const };
  });

export const setAccountingMapping = accountingWriteProcedure
  .route({ method: "PUT", summary: "Liga categoria/conta bancária a uma conta contábil", tags: ["Accounting"] })
  .input(
    z.object({
      sourceType: z.enum(["CATEGORY", "BANK_ACCOUNT"]),
      sourceId: z.string(),
      accountId: z.string().nullable(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const key = { organizationId, sourceType: input.sourceType, sourceId: input.sourceId };
    if (!input.accountId) {
      await prisma.accountingMapping.deleteMany({ where: key });
    } else {
      const account = await prisma.accountingAccount.findFirst({
        where: { id: input.accountId, organizationId, isAnalytical: true },
        select: { id: true },
      });
      if (!account) throw errors.BAD_REQUEST({ message: "Escolha uma conta analítica do seu plano." });
      await prisma.accountingMapping.upsert({
        where: { organizationId_sourceType_sourceId: key },
        create: { ...key, accountId: account.id },
        update: { accountId: account.id },
      });
    }
    // Mudou o destino: a contabilidade inteira é reprocessada em background.
    await inngest.send({ name: "accounting/journal.backfill", data: { organizationId } }).catch((error: unknown) => {
      console.error("[accounting/mapping] reprocessamento não enfileirado:", error);
    });
    return { ok: true as const };
  });

const trialRowShape = z.object({
  accountId: z.string(),
  code: z.string(),
  name: z.string(),
  nature: natureSchema,
  isAnalytical: z.boolean(),
  openingCents: z.number(),
  debitCents: z.number(),
  creditCents: z.number(),
  closingCents: z.number(),
});

export const getAccountingTrialBalance = accountingReadProcedure
  .route({ method: "GET", summary: "Balancete", tags: ["Accounting"] })
  .input(periodInput)
  .output(z.object({ rows: z.array(trialRowShape), totalDebitCents: z.number(), totalCreditCents: z.number(), isBalanced: z.boolean() }))
  .handler(async ({ input, context }) => loadTrialBalance({ organizationId: context.org.id, ...parseRange(input) }));

export const getAccountingLedger = accountingReadProcedure
  .route({ method: "GET", summary: "Razão de uma conta", tags: ["Accounting"] })
  .input(periodInput.extend({ accountId: z.string() }))
  .output(
    z.object({
      account: z.object({ id: z.string(), code: z.string(), name: z.string(), nature: natureSchema }),
      openingCents: z.number(),
      closingCents: z.number(),
      movements: z.array(
        z.object({
          id: z.string(),
          date: z.date(),
          description: z.string(),
          sourceType: z.string(),
          sourceId: z.string().nullable(),
          sourceEvent: z.string(),
          debitCents: z.number(),
          creditCents: z.number(),
          balanceCents: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const ledger = await loadLedger({ organizationId: context.org.id, accountId: input.accountId, ...parseRange(input) });
    if (!ledger) throw errors.NOT_FOUND({ message: "Conta não encontrada" });
    return ledger;
  });

const balanceSectionShape = z.object({
  totalCents: z.number(),
  rows: z.array(z.object({ code: z.string(), name: z.string(), amountCents: z.number() })),
});

export const getAccountingBalanceSheet = accountingReadProcedure
  .route({ method: "GET", summary: "Balanço patrimonial", tags: ["Accounting"] })
  .input(z.object({ at: z.string() }))
  .output(
    z.object({
      at: z.date(),
      assets: balanceSectionShape,
      liabilities: balanceSectionShape,
      equity: balanceSectionShape.extend({ periodResultCents: z.number() }),
      isBalanced: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) =>
    loadBalanceSheet({ organizationId: context.org.id, at: new Date(`${input.at.slice(0, 10)}T23:59:59Z`) }),
  );

export const reprocessAccountingJournal = accountingWriteProcedure
  .route({ method: "POST", summary: "Reprocessa a contabilidade de todos os lançamentos", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ context }) => {
    await inngest.send({ name: "accounting/journal.backfill", data: { organizationId: context.org.id } });
    return { ok: true as const };
  });
