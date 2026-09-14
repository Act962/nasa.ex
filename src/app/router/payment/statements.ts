import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { decodeOfxBuffer } from "@/features/payment/lib/ofx/decode-ofx-buffer";
import { parseOfxStatement } from "@/features/payment/lib/ofx/parse-statement";
import { hashStatementFile } from "@/features/payment/server/statements/read-statement-file";
import { findBankByCode } from "@/features/payment/lib/banks";
import { ingestStatement } from "@/features/payment/server/statements/ingest-statement";
import { suggestMatches } from "@/features/payment/server/statements/suggest-matches";
import {
  applyPaymentToEntry,
  revertPaymentFromEntry,
} from "@/features/payment/server/statements/apply-payment";
import { z } from "zod";

const PAGE_SIZE = 25;

const transactionShape = z.object({
  id: z.string(),
  accountId: z.string(),
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

export const importPaymentStatement = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "create"))
  .route({ method: "POST", summary: "Import bank statement (OFX)", tags: ["Payment"] })
  .input(
    z.object({
      accountId: z.string(),
      fileName: z.string(),
      // Conteúdo em base64. O extrato é um arquivo de dezenas de KB e o
      // encoding precisa ser detectado a partir dos bytes originais — mandar
      // como texto já decodificado pelo navegador perderia essa informação.
      contentBase64: z.string().max(8_000_000, "Arquivo grande demais"),
    }),
  )
  .output(
    z.object({
      importId: z.string(),
      total: z.number(),
      imported: z.number(),
      duplicated: z.number(),
      invalid: z.number(),
      warnings: z.array(
        z.object({ code: z.string(), message: z.string(), severity: z.string() }),
      ),
      alreadyImportedAt: z.date().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const account = await prisma.paymentBankAccount.findFirst({
      where: { id: input.accountId, organizationId: context.org.id },
      select: { id: true, name: true, ofxAccountId: true },
    });
    if (!account) throw errors.NOT_FOUND({ message: "Conta bancária não encontrada" });

    try {
      const buffer = Buffer.from(input.contentBase64, "base64");
      if (buffer.length === 0) {
        throw new Error("Arquivo vazio");
      }
      const fileHash = hashStatementFile(buffer);
      const { content } = decodeOfxBuffer(buffer);
      const statement = parseOfxStatement(content, "OFX_UPLOAD");

      // O extrato carrega a conta de origem; importar na conta errada
      // embaralharia duas contas na mesma fila.
      if (
        statement.accountId &&
        account.ofxAccountId &&
        statement.accountId !== account.ofxAccountId
      ) {
        throw errors.BAD_REQUEST({
          message: `Este extrato é da conta ${statement.accountId}, mas "${account.name}" está vinculada à conta ${account.ofxAccountId}.`,
        });
      }

      const previous = await prisma.paymentStatementImport.findFirst({
        where: { organizationId: context.org.id, accountId: account.id, fileHash },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      const result = await ingestStatement({
        organizationId: context.org.id,
        accountId: account.id,
        createdById: context.user.id,
        fileName: input.fileName,
        fileHash,
        statement,
      });

      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        appSlug: "payment",
        subAppSlug: "payment-statements",
        featureKey: "payment.statement.imported",
        action: "payment.statement.imported",
        actionLabel: `Importou extrato "${input.fileName}" (${result.imported} transações novas)`,
        resource: input.fileName,
        resourceId: result.importId,
        metadata: { ...result, accountId: account.id },
      });

      return {
        ...result,
        warnings: statement.warnings,
        alreadyImportedAt: previous?.createdAt ?? null,
      };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err) throw err;
      console.error("[payment/statements/import]", err);
      throw errors.BAD_REQUEST({
        message:
          err instanceof Error
            ? err.message
            : "Não foi possível ler o arquivo. Confira se é o extrato em OFX.",
      });
    }
  });

/**
 * Lê o cabeçalho do extrato sem gravar nada, para a tela already mostrar de que
 * banco e conta o arquivo é e já apontar a conta cadastrada correspondente.
 *
 * Existe como passo separado da importação de propósito: o usuário confirma o
 * destino antes de qualquer escrita, em vez de descobrir depois que o extrato
 * entrou na conta errada.
 */
export const inspectPaymentStatement = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "POST", summary: "Inspect statement before import", tags: ["Payment"] })
  .input(z.object({ contentBase64: z.string().max(8_000_000) }))
  .output(
    z.object({
      bankId: z.string().nullable(),
      bankName: z.string().nullable(),
      statementAccountId: z.string().nullable(),
      periodStart: z.date().nullable(),
      periodEnd: z.date().nullable(),
      transactionCount: z.number(),
      suggestedAccountId: z.string().nullable(),
      /** Por que aquela conta foi apontada — a tela mostra isso ao usuário. */
      matchReason: z.enum(["EXACT_ACCOUNT", "BANK_CODE", "ONLY_ACCOUNT", "NONE"]),
      warnings: z.array(
        z.object({ code: z.string(), message: z.string(), severity: z.string() }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const buffer = Buffer.from(input.contentBase64, "base64");
      if (buffer.length === 0) throw new Error("Arquivo vazio");

      const { content } = decodeOfxBuffer(buffer);
      const statement = parseOfxStatement(content, "OFX_UPLOAD");

      const accounts = await prisma.paymentBankAccount.findMany({
        where: { organizationId: context.org.id, isActive: true },
        select: { id: true, ofxAccountId: true, bankCode: true },
      });

      // Da pista mais forte para a mais fraca: a conta que já recebeu extrato
      // desta mesma conta bancária, depois a que declara o mesmo banco, e por
      // fim — só quando existe uma única conta cadastrada — ela mesma.
      const byAccount = statement.accountId
        ? accounts.find((account) => account.ofxAccountId === statement.accountId)
        : undefined;

      const statementBankDigits = statement.bankId
        ? String(Number(statement.bankId.replace(/\D/g, "")))
        : null;
      const byBank = statementBankDigits
        ? accounts.filter(
            (account) =>
              account.bankCode &&
              String(Number(account.bankCode.replace(/\D/g, ""))) === statementBankDigits,
          )
        : [];

      let suggestedAccountId: string | null = null;
      let matchReason: "EXACT_ACCOUNT" | "BANK_CODE" | "ONLY_ACCOUNT" | "NONE" = "NONE";

      if (byAccount) {
        suggestedAccountId = byAccount.id;
        matchReason = "EXACT_ACCOUNT";
      } else if (byBank.length === 1) {
        // Só sugere por banco quando há uma única candidata: com duas contas no
        // mesmo banco, apontar uma seria adivinhação.
        suggestedAccountId = byBank[0].id;
        matchReason = "BANK_CODE";
      } else if (accounts.length === 1 && byBank.length === 0) {
        suggestedAccountId = accounts[0].id;
        matchReason = "ONLY_ACCOUNT";
      }

      return {
        bankId: statement.bankId,
        bankName: findBankByCode(statement.bankId)?.name ?? null,
        statementAccountId: statement.accountId,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        transactionCount: statement.transactions.length,
        suggestedAccountId,
        matchReason,
        warnings: statement.warnings,
      };
    } catch (err) {
      console.error("[payment/statements/inspect]", err);
      throw errors.BAD_REQUEST({
        message:
          err instanceof Error
            ? err.message
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
      transactions: z.array(
        transactionShape.extend({ suggestion: suggestionShape.nullable() }),
      ),
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
      const where = {
        organizationId: context.org.id,
        status: input.status,
        ...(input.accountId ? { accountId: input.accountId } : {}),
        ...(input.importId ? { importId: input.importId } : {}),
        ...(input.direction ? { direction: input.direction } : {}),
        ...(input.search
          ? {
              OR: [
                { memo: { contains: input.search, mode: "insensitive" as const } },
                { counterpartyName: { contains: input.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [transactions, total, credits, debits, pendingCount] = await Promise.all([
        prisma.paymentBankTransaction.findMany({
          where,
          orderBy: { postedDate: "desc" },
          skip: (input.page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        prisma.paymentBankTransaction.count({ where }),
        prisma.paymentBankTransaction.aggregate({
          where: { ...where, direction: "CREDIT" },
          _sum: { amountCents: true },
        }),
        prisma.paymentBankTransaction.aggregate({
          where: { ...where, direction: "DEBIT" },
          _sum: { amountCents: true },
        }),
        prisma.paymentBankTransaction.count({
          where: { organizationId: context.org.id, status: "PENDING" },
        }),
      ]);

      const suggestions =
        input.withSuggestions && input.status === "PENDING"
          ? await suggestMatches({
              organizationId: context.org.id,
              transactions: transactions.map((transaction) => ({
                id: transaction.id,
                direction: transaction.direction,
                amountCents: transaction.amountCents,
                postedDate: transaction.postedDate,
                memo: transaction.memo,
                counterpartyName: transaction.counterpartyName,
                counterpartyDocument: transaction.counterpartyDocument,
              })),
            })
          : new Map();

      const entryIds = [...suggestions.values()].map((s) => s.entryId);
      const entries = entryIds.length
        ? await prisma.paymentEntry.findMany({
            where: { id: { in: entryIds } },
            select: {
              id: true,
              description: true,
              amount: true,
              paidAmount: true,
              dueDate: true,
              type: true,
              contact: { select: { name: true } },
            },
          })
        : [];
      const entryById = new Map(entries.map((entry) => [entry.id, entry]));

      return {
        transactions: transactions.map((transaction) => {
          const suggestion = suggestions.get(transaction.id);
          const entry = suggestion ? entryById.get(suggestion.entryId) : undefined;
          return {
            ...transaction,
            suggestion:
              suggestion && entry
                ? {
                    entryId: suggestion.entryId,
                    score: suggestion.score,
                    confidence: suggestion.confidence,
                    reasons: suggestion.reasons,
                    isAmbiguous: suggestion.isAmbiguous,
                    entry: {
                      id: entry.id,
                      description: entry.description,
                      amount: entry.amount,
                      paidAmount: entry.paidAmount,
                      dueDate: entry.dueDate,
                      type: entry.type,
                      contactName: entry.contact?.name ?? null,
                    },
                  }
                : null,
          };
        }),
        total,
        totals: {
          creditCents: credits._sum.amountCents ?? 0,
          debitCents: debits._sum.amountCents ?? 0,
          pendingCount,
        },
      };
    } catch (err) {
      console.error("[payment/statements/transactions]", err);
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
    const [transaction, entry] = await Promise.all([
      prisma.paymentBankTransaction.findFirst({
        where: { id: input.transactionId, organizationId: context.org.id },
      }),
      prisma.paymentEntry.findFirst({
        where: { id: input.entryId, organizationId: context.org.id },
        select: { id: true, amount: true, paidAmount: true, status: true, description: true },
      }),
    ]);

    if (!transaction) throw errors.NOT_FOUND({ message: "Transação não encontrada" });
    if (!entry) throw errors.NOT_FOUND({ message: "Lançamento não encontrado" });
    if (transaction.status !== "PENDING") {
      throw errors.BAD_REQUEST({ message: "Esta transação já foi resolvida" });
    }
    if (entry.status === "CANCELLED") {
      throw errors.BAD_REQUEST({ message: "Não é possível conciliar com um lançamento cancelado" });
    }
    if (transaction.amountCents > entry.amount - entry.paidAmount) {
      throw errors.BAD_REQUEST({
        message: "O valor da transação é maior que o saldo em aberto do lançamento",
      });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const applied = await applyPaymentToEntry(tx, {
          entryId: entry.id,
          amountCents: transaction.amountCents,
          paidAt: transaction.postedDate,
          accountId: transaction.accountId,
        });
        await tx.paymentBankTransaction.update({
          where: { id: transaction.id },
          data: {
            status: "MATCHED",
            matchedEntryId: entry.id,
            matchedAt: new Date(),
            matchedById: context.user.id,
            matchMethod: "MANUAL",
          },
        });
        return applied;
      });

      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        appSlug: "payment",
        subAppSlug: "payment-statements",
        featureKey: "payment.statement.reconciled",
        action: "payment.statement.reconciled",
        actionLabel: `Conciliou extrato com "${entry.description}"`,
        resource: entry.description,
        resourceId: entry.id,
        metadata: { transactionId: transaction.id, amountCents: transaction.amountCents },
      });

      return { success: true, entryStatus: result.status };
    } catch (err) {
      console.error("[payment/statements/reconcile]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const unmatchStatementTransaction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Undo reconciliation", tags: ["Payment"] })
  .input(z.object({ transactionId: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const transaction = await prisma.paymentBankTransaction.findFirst({
      where: { id: input.transactionId, organizationId: context.org.id },
    });
    if (!transaction) throw errors.NOT_FOUND({ message: "Transação não encontrada" });
    if (transaction.status !== "MATCHED" || !transaction.matchedEntryId) {
      throw errors.BAD_REQUEST({ message: "Esta transação não está conciliada" });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await revertPaymentFromEntry(tx, {
          entryId: transaction.matchedEntryId!,
          amountCents: transaction.amountCents,
        });
        await tx.paymentBankTransaction.update({
          where: { id: transaction.id },
          data: {
            status: "PENDING",
            matchedEntryId: null,
            matchedAt: null,
            matchedById: null,
            matchMethod: null,
          },
        });
      });
      return { success: true };
    } catch (err) {
      console.error("[payment/statements/unmatch]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
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
    const transaction = await prisma.paymentBankTransaction.findFirst({
      where: { id: input.transactionId, organizationId: context.org.id },
    });
    if (!transaction) throw errors.NOT_FOUND({ message: "Transação não encontrada" });
    if (transaction.status !== "PENDING") {
      throw errors.BAD_REQUEST({ message: "Esta transação já foi resolvida" });
    }

    try {
      const entryId = await prisma.$transaction(async (tx) => {
        const entry = await tx.paymentEntry.create({
          data: {
            organizationId: context.org.id,
            createdById: context.user.id,
            type: transaction.direction === "CREDIT" ? "RECEIVABLE" : "PAYABLE",
            description: input.description,
            amount: transaction.amountCents,
            paidAmount: transaction.amountCents,
            // Nasce quitado e sem passar por aprovação: o dinheiro já se moveu
            // na conta, e aprovar um fato consumado só encheria a fila.
            status: "PAID",
            dueDate: transaction.postedDate,
            paidAt: transaction.postedDate,
            accountId: transaction.accountId,
            categoryId: input.categoryId ?? null,
            contactId: input.contactId ?? null,
            notes: transaction.memo,
          },
          select: { id: true },
        });

        await tx.paymentBankTransaction.update({
          where: { id: transaction.id },
          data: {
            status: "MATCHED",
            matchedEntryId: entry.id,
            matchedAt: new Date(),
            matchedById: context.user.id,
            matchMethod: "CREATED",
          },
        });

        return entry.id;
      });

      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        appSlug: "payment",
        subAppSlug: "payment-statements",
        featureKey: "payment.statement.entry_created",
        action: "payment.statement.entry_created",
        actionLabel: `Criou "${input.description}" a partir do extrato`,
        resource: input.description,
        resourceId: entryId,
        metadata: { transactionId: transaction.id, amountCents: transaction.amountCents },
      });

      return { entryId };
    } catch (err) {
      console.error("[payment/statements/create-entry]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const ignoreStatementTransaction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Ignore/unignore transaction", tags: ["Payment"] })
  .input(z.object({ transactionId: z.string(), reason: z.string().optional(), undo: z.boolean().default(false) }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const transaction = await prisma.paymentBankTransaction.findFirst({
      where: { id: input.transactionId, organizationId: context.org.id },
      select: { id: true, status: true },
    });
    if (!transaction) throw errors.NOT_FOUND({ message: "Transação não encontrada" });
    if (transaction.status === "MATCHED") {
      throw errors.BAD_REQUEST({ message: "Desfaça a conciliação antes de ignorar" });
    }

    await prisma.paymentBankTransaction.update({
      where: { id: transaction.id },
      data: input.undo
        ? { status: "PENDING", ignoredReason: null }
        : { status: "IGNORED", ignoredReason: input.reason ?? null },
    });
    return { success: true };
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
