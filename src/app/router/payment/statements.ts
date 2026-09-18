import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { STATEMENT_SOURCES } from "@/features/payment/server/statements/ports";
import type { StatementFailure } from "@/features/payment/server/statements/service-result";
import {
  importStatementFromAttachment,
  importStatementFromBuffer,
} from "@/features/payment/server/statements/import-statement";
import {
  inspectStatementFromAttachment,
  inspectStatementFromBuffer,
} from "@/features/payment/server/statements/inspect-statement";
import { listStatementTransactionsRecord } from "@/features/payment/server/statements/list-transactions";
import {
  reconcileStatementTransactionRecord,
  type ReconcileTransactionResult,
} from "@/features/payment/server/statements/reconcile-transaction";
import {
  createEntryFromStatementTransaction,
  type CreateEntryFromTransactionResult,
} from "@/features/payment/server/statements/create-entry-from-transaction";
import { ignoreStatementTransactionRecord } from "@/features/payment/server/statements/ignore-transaction";
import { unmatchStatementTransactionRecord } from "@/features/payment/server/statements/unmatch-transaction";
import {
  markTransactionReviewedRecord,
  reviewTransactionWithAstro,
} from "@/features/payment/server/statements/review-transaction";
import { z } from "zod";

// Handlers finos da conciliação (specs 0013 e 0016): validação de entrada,
// permissão e tradução de falha em erro oRPC. A regra mora nos serviços.

const reviewFieldStatus = z.enum(["match", "divergent", "unknown"]);
const reviewResultShape = z.object({
  checkedAt: z.string(),
  attachmentId: z.string(),
  matches: z.boolean(),
  payer: z.object({ status: reviewFieldStatus, expected: z.string().nullable(), found: z.string().nullable() }),
  amount: z.object({ status: reviewFieldStatus, expectedCents: z.number(), foundCents: z.number().nullable() }),
  date: z.object({ status: reviewFieldStatus, expected: z.string().nullable(), found: z.string().nullable() }),
  warnings: z.array(z.string()),
});

const transactionShape = z.object({
  id: z.string(),
  accountId: z.string(),
  source: z.enum(STATEMENT_SOURCES),
  direction: z.enum(["CREDIT", "DEBIT"]),
  amountCents: z.number(),
  postedAt: z.date(),
  postedDate: z.date(),
  memo: z.string(),
  memoKind: z.string().nullable(),
  counterpartyName: z.string().nullable(),
  counterpartyDocument: z.string().nullable(),
  counterpartyDocumentMasked: z.boolean(),
  status: z.enum(["PENDING", "MATCHED", "IGNORED"]),
  matchedEntryId: z.string().nullable(),
  ignoredReason: z.string().nullable(),
  reviewedAt: z.date().nullable(),
  reviewResult: reviewResultShape.nullable(),
  comprovanteAttachmentId: z.string().nullable(),
});

const suggestionShape = z.object({
  entryId: z.string(),
  score: z.number(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reasons: z.array(z.string()),
  isAmbiguous: z.boolean(),
  entry: z.object({
    id: z.string(),
    description: z.string(),
    amount: z.number(),
    paidAmount: z.number(),
    dueDate: z.date(),
    type: z.enum(["RECEIVABLE", "PAYABLE"]),
    contactName: z.string().nullable(),
  }),
});

const warningShape = z.object({ code: z.string(), message: z.string(), severity: z.string() });

interface StatementErrorFactories {
  NOT_FOUND(options: { message: string }): Error;
  BAD_REQUEST(options: { message: string }): Error;
}

function toStatementError(errors: StatementErrorFactories, failure: StatementFailure): Error {
  return failure.reason === "not_found"
    ? errors.NOT_FOUND({ message: failure.message })
    : errors.BAD_REQUEST({ message: failure.message });
}

function isOrpcError(error: unknown): boolean {
  return Boolean(error) && typeof error === "object" && error !== null && "code" in error;
}

export const importPaymentStatement = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "create"))
  .route({ method: "POST", summary: "Import bank statement (OFX or PDF)", tags: ["Payment"] })
  .input(
    z
      .object({
        accountId: z.string(),
        fileName: z.string(),
        // OFX em base64: o encoding é detectado a partir dos bytes originais.
        contentBase64: z.string().max(8_000_000, "Arquivo grande demais").optional(),
        // PDF (ou OFX) já enviado como anexo financeiro.
        attachmentId: z.string().optional(),
      })
      .refine((input) => input.contentBase64 !== undefined || input.attachmentId !== undefined, {
        message: "Envie o arquivo do extrato",
      }),
  )
  .output(
    z.object({
      importId: z.string(),
      total: z.number(),
      imported: z.number(),
      duplicated: z.number(),
      invalid: z.number(),
      warnings: z.array(warningShape),
      alreadyImportedAt: z.date().nullable(),
      source: z.enum(STATEMENT_SOURCES),
      starsCharged: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const result = input.attachmentId
        ? await importStatementFromAttachment({
            organizationId: context.org.id,
            accountId: input.accountId,
            attachmentId: input.attachmentId,
            createdById: context.user.id,
          })
        : await importStatementFromBuffer({
            organizationId: context.org.id,
            accountId: input.accountId,
            createdById: context.user.id,
            fileName: input.fileName,
            buffer: Buffer.from(input.contentBase64 ?? "", "base64"),
          });
      if (!result.ok) throw toStatementError(errors, result);

      return {
        importId: result.importId,
        total: result.total,
        imported: result.imported,
        duplicated: result.duplicated,
        invalid: result.invalid,
        warnings: result.warnings,
        alreadyImportedAt: result.alreadyImportedAt,
        source: result.source,
        starsCharged: result.starsCharged,
      };
    } catch (error) {
      if (isOrpcError(error)) throw error;
      console.error("[payment/statements/import]", error);
      throw errors.BAD_REQUEST({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível ler o arquivo. Confira se é o extrato em OFX.",
      });
    }
  });

export const inspectPaymentStatement = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "POST", summary: "Inspect statement before import", tags: ["Payment"] })
  .input(
    z
      .object({
        contentBase64: z.string().max(8_000_000).optional(),
        attachmentId: z.string().optional(),
      })
      .refine((input) => input.contentBase64 !== undefined || input.attachmentId !== undefined, {
        message: "Envie o arquivo do extrato",
      }),
  )
  .output(
    z.object({
      source: z.enum(STATEMENT_SOURCES),
      attachmentId: z.string().nullable(),
      bankId: z.string().nullable(),
      bankName: z.string().nullable(),
      statementAccountId: z.string().nullable(),
      periodStart: z.date().nullable(),
      periodEnd: z.date().nullable(),
      transactionCount: z.number(),
      suggestedAccountId: z.string().nullable(),
      /** Por que aquela conta foi apontada — a tela mostra isso ao usuário. */
      matchReason: z.enum(["EXACT_ACCOUNT", "BANK_CODE", "ONLY_ACCOUNT", "NONE"]),
      warnings: z.array(warningShape),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const result = input.attachmentId
        ? await inspectStatementFromAttachment({
            organizationId: context.org.id,
            attachmentId: input.attachmentId,
            userId: context.user.id,
          })
        : await inspectStatementFromBuffer({
            organizationId: context.org.id,
            buffer: Buffer.from(input.contentBase64 ?? "", "base64"),
          });
      if (!result.ok) throw toStatementError(errors, result);

      const { inspection } = result;
      return {
        source: inspection.source,
        attachmentId: inspection.attachmentId,
        bankId: inspection.bankId,
        bankName: inspection.bankName,
        statementAccountId: inspection.statementAccountId,
        periodStart: inspection.periodStart,
        periodEnd: inspection.periodEnd,
        transactionCount: inspection.transactionCount,
        suggestedAccountId: inspection.suggestedAccountId,
        matchReason: inspection.matchReason,
        warnings: inspection.warnings,
      };
    } catch (error) {
      if (isOrpcError(error)) throw error;
      console.error("[payment/statements/inspect]", error);
      throw errors.BAD_REQUEST({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível ler o arquivo. Confira se é o extrato em OFX.",
      });
    }
  });

export const listStatementTransactions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "GET", summary: "List bank transactions", tags: ["Payment"] })
  .input(
    z.object({
      accountId: z.string().optional(),
      importId: z.string().optional(),
      status: z.enum(["PENDING", "MATCHED", "IGNORED"]).default("PENDING"),
      direction: z.enum(["CREDIT", "DEBIT"]).optional(),
      search: z.string().optional(),
      withSuggestions: z.boolean().default(true),
      page: z.number().default(1),
    }),
  )
  .output(
    z.object({
      transactions: z.array(transactionShape.extend({ suggestion: suggestionShape.nullable() })),
      total: z.number(),
      totals: z.object({
        creditCents: z.number(),
        debitCents: z.number(),
        pendingCount: z.number(),
      }),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      return await listStatementTransactionsRecord({ organizationId: context.org.id, ...input });
    } catch (error) {
      console.error("[payment/statements/transactions]", error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const reconcileStatementTransaction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Reconcile transaction with entry", tags: ["Payment"] })
  .input(z.object({ transactionId: z.string(), entryId: z.string() }))
  .output(z.object({ success: z.boolean(), entryStatus: z.string() }))
  .handler(async ({ input, context, errors }) => {
    let result: ReconcileTransactionResult;
    try {
      result = await reconcileStatementTransactionRecord({
        organizationId: context.org.id,
        actor: { id: context.user.id, name: context.user.name, email: context.user.email },
        transactionId: input.transactionId,
        entryId: input.entryId,
      });
    } catch (error) {
      console.error("[payment/statements/reconcile]", error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!result.ok) throw toStatementError(errors, result);
    return { success: true, entryStatus: result.entryStatus };
  });

export const unmatchStatementTransaction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Undo reconciliation", tags: ["Payment"] })
  .input(z.object({ transactionId: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    let result: Awaited<ReturnType<typeof unmatchStatementTransactionRecord>>;
    try {
      result = await unmatchStatementTransactionRecord({
        organizationId: context.org.id,
        transactionId: input.transactionId,
      });
    } catch (error) {
      console.error("[payment/statements/unmatch]", error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!result.ok) throw toStatementError(errors, result);
    return { success: true };
  });

export const createEntryFromTransaction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "create"))
  .route({ method: "POST", summary: "Create entry from transaction", tags: ["Payment"] })
  .input(
    z.object({
      transactionId: z.string(),
      description: z.string().trim().min(1, "Informe uma descrição"),
      categoryId: z.string().nullable().optional(),
      contactId: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ entryId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    let result: CreateEntryFromTransactionResult;
    try {
      result = await createEntryFromStatementTransaction({
        organizationId: context.org.id,
        actor: { id: context.user.id, name: context.user.name, email: context.user.email },
        transactionId: input.transactionId,
        description: input.description,
        categoryId: input.categoryId,
        contactId: input.contactId,
      });
    } catch (error) {
      console.error("[payment/statements/create-entry]", error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!result.ok) throw toStatementError(errors, result);
    return { entryId: result.entryId };
  });

export const ignoreStatementTransaction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Ignore/unignore transaction", tags: ["Payment"] })
  .input(z.object({ transactionId: z.string(), reason: z.string().optional(), undo: z.boolean().default(false) }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const result = await ignoreStatementTransactionRecord({
      organizationId: context.org.id,
      transactionId: input.transactionId,
      reason: input.reason,
      undo: input.undo,
    });
    if (!result.ok) throw toStatementError(errors, result);
    return { success: true };
  });

export const markStatementTransactionReviewed = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Mark transaction as reviewed", tags: ["Payment"] })
  .input(z.object({ transactionId: z.string(), reviewed: z.boolean().default(true) }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const result = await markTransactionReviewedRecord({
      organizationId: context.org.id,
      transactionId: input.transactionId,
      reviewedById: context.user.id,
      reviewed: input.reviewed,
    });
    if (!result.ok) throw toStatementError(errors, result);
    return { success: true };
  });

export const reviewStatementTransactionWithAstro = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Read receipt with Astro and check payer/amount/date", tags: ["Payment"] })
  .input(z.object({ transactionId: z.string() }))
  .output(z.object({ success: z.boolean(), review: reviewResultShape }))
  .handler(async ({ input, context, errors }) => {
    let result: Awaited<ReturnType<typeof reviewTransactionWithAstro>>;
    try {
      result = await reviewTransactionWithAstro({
        organizationId: context.org.id,
        transactionId: input.transactionId,
        userId: context.user.id,
      });
    } catch (error) {
      console.error("[payment/statements/review-astro]", error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!result.ok) throw toStatementError(errors, result);
    return { success: true, review: result.review };
  });

export const listStatementImports = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "GET", summary: "List statement imports", tags: ["Payment"] })
  .input(z.object({ accountId: z.string().optional(), limit: z.number().default(10) }))
  .output(
    z.object({
      imports: z.array(
        z.object({
          id: z.string(),
          fileName: z.string(),
          accountId: z.string(),
          periodStart: z.date().nullable(),
          periodEnd: z.date().nullable(),
          totalCount: z.number(),
          importedCount: z.number(),
          duplicateCount: z.number(),
          createdAt: z.date(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const imports = await prisma.paymentStatementImport.findMany({
      where: {
        organizationId: context.org.id,
        ...(input.accountId ? { accountId: input.accountId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        fileName: true,
        accountId: true,
        periodStart: true,
        periodEnd: true,
        totalCount: true,
        importedCount: true,
        duplicateCount: true,
        createdAt: true,
      },
    });
    return { imports };
  });
