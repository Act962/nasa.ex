import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { isValidDateValue } from "@/features/payment/lib/dates";
import { queryPaymentEntries } from "@/features/payment/server/entries/query-entries";
import { createPaymentEntryRecord } from "@/features/payment/server/entries/create-entry";
import { updatePaymentEntryRecord } from "@/features/payment/server/entries/update-entry";
import { payPaymentEntryRecord } from "@/features/payment/server/entries/pay-entry";
import { generateEntryInstallments } from "@/features/payment/server/entries/generate-installments";
import { MAX_INSTALLMENTS } from "@/features/payment/schemas/entry-form-schema";
import { formatCents } from "@/features/payment/server/entries/entry-include";

// As procedures validam contrato e traduzem resultado em erro HTTP; a lógica
// mora em `features/payment/server/entries/*`, compartilhada com o Astro.

const entryStatusSchema = z.enum([
  "PENDING_APPROVAL",
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

const entryShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  status: entryStatusSchema,
  description: z.string(),
  amount: z.number(),
  paidAmount: z.number(),
  dueDate: z.date(),
  paidAt: z.date().nullable(),
  competenceDate: z.date().nullable(),
  documentNumber: z.string().nullable(),
  notes: z.string().nullable(),
  attachmentUrl: z.string().nullable(),
  categoryId: z.string().nullable(),
  costCenterId: z.string().nullable(),
  contactId: z.string().nullable(),
  accountId: z.string().nullable(),
  trackingId: z.string().nullable(),
  leadId: z.string().nullable(),
  installmentTotal: z.number().nullable(),
  installmentCurrent: z.number().nullable(),
  installmentGroupId: z.string().nullable(),
  isRecurring: z.boolean(),
  recurrenceType: z.string().nullable(),
  // Governança Fase 2
  requiresApproval: z.boolean(),
  approvalThresholdAmountCents: z.number().nullable(),
  // Régua de cobrança Fase 2
  dunningRuleId: z.string().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  category: z.object({ id: z.string(), name: z.string(), type: z.string(), color: z.string().nullable() }).nullable(),
  contact: z.object({ id: z.string(), name: z.string(), contactType: z.string() }).nullable(),
  account: z.object({ id: z.string(), name: z.string(), type: z.string() }).nullable(),
  approvalRequest: z
    .object({
      id: z.string(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
      requestedById: z.string(),
      requestedAt: z.date(),
      decidedAt: z.date().nullable(),
    })
    .nullable(),
});

export const listPaymentEntries = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "GET", summary: "List payment entries", tags: ["Payment"] })
  .input(z.object({
    type: z.enum(["RECEIVABLE", "PAYABLE"]).optional(),
    status: entryStatusSchema.optional(),
    // Filtro por múltiplos statuses — usado pelo drill-down do dashboard
    // (ex.: "A Receber" = PENDING + PARTIAL + OVERDUE)
    statuses: z.array(entryStatusSchema).optional(),
    contactId: z.string().optional(),
    categoryId: z.string().optional(),
    // Multi-seleção do filtro compartilhado do módulo. Convive com o
    // `categoryId` singular, que outros callers (drill-down) ainda usam.
    categoryIds: z.array(z.string()).optional(),
    accountId: z.string().optional(),
    // Filtros novos pra histórico de orçamentos do lead no chat.
    leadId: z.string().optional(),
    trackingId: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    // Filtro pela data de pagamento (usado em cards "Recebido" / "Pago no mês")
    paidFrom: z.string().optional(),
    paidTo: z.string().optional(),
    search: z.string().optional(),
    orderBy: z
      .enum([
        "dueDate_asc", "dueDate_desc",
        "amount_asc", "amount_desc",
        "status_asc", "status_desc",
        "paidAt_asc", "paidAt_desc",
        "description_asc", "description_desc",
        "createdAt_asc", "createdAt_desc",
        "contact_asc", "contact_desc",
        "category_asc", "category_desc",
      ])
      .optional(),
    page: z.number().default(1),
    perPage: z.number().default(50),
  }))
  .output(z.object({
    entries: z.array(entryShape),
    total: z.number(),
    // Somatórios do filtro inteiro, não só da página devolvida — a tela mostra
    // "Total pendente" no cabeçalho e somar apenas a página daria um número
    // que muda ao virar de página.
    totals: z.object({
      amount: z.number(),
      paidAmount: z.number(),
      pendingAmount: z.number(),
    }),
  }))
  .handler(async ({ input, context, errors }) => {
    try {
      return await queryPaymentEntries({ organizationId: context.org.id, ...input });
    } catch (err) {
      console.error("[payment/entries list]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// Descrições usadas recentemente, pra oferecer preenchimento rápido no form.
// A dedupe é em JS porque o `distinct` do Prisma roda depois do `take` e
// devolveria menos opções que o pedido.
const RECENT_DESCRIPTIONS_SCAN = 60;

export const listRecentEntryDescriptions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "GET", summary: "List recent entry descriptions", tags: ["Payment"] })
  .input(z.object({
    type: z.enum(["RECEIVABLE", "PAYABLE"]),
    limit: z.number().default(6),
  }))
  .output(z.object({ descriptions: z.array(z.string()) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const rows = await prisma.paymentEntry.findMany({
        where: { organizationId: context.org.id, type: input.type },
        select: { description: true },
        orderBy: { createdAt: "desc" },
        take: RECENT_DESCRIPTIONS_SCAN,
      });

      const seen = new Set<string>();
      const descriptions: string[] = [];
      for (const row of rows) {
        const description = row.description.trim();
        const key = description.toLowerCase();
        if (!description || seen.has(key)) continue;
        seen.add(key);
        descriptions.push(description);
        if (descriptions.length >= input.limit) break;
      }

      return { descriptions };
    } catch (err) {
      console.error("[payment/entries recentDescriptions]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createPaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "create"))
  .route({ method: "POST", summary: "Create payment entry", tags: ["Payment"] })
  .input(z.object({
    type: z.enum(["RECEIVABLE", "PAYABLE"]),
    // Validado aqui além do formulário: a procedure também é chamada pelo
    // painel de orçamento do chat, e um 500 genérico escondia a causa.
    description: z.string().trim().min(1, "Informe uma descrição"),
    amount: z.number().int().positive("O valor precisa ser maior que zero"),
    dueDate: z.string().refine(isValidDateValue, "Data de vencimento inválida"),
    categoryId: z.string().optional(),
    costCenterId: z.string().optional(),
    contactId: z.string().optional(),
    accountId: z.string().optional(),
    // Vínculos opcionais com tracking/lead — usado pela feature de
    // Orçamento (chat → "+") pra rastrear A receber por lead específico.
    trackingId: z.string().optional(),
    leadId: z.string().optional(),
    notes: z.string().optional(),
    documentNumber: z.string().optional(),
    competenceDate: z.string().refine(isValidDateValue, "Data de competência inválida").optional(),
    installments: z.number().int().min(1).max(12).default(1),
    isRecurring: z.boolean().default(false),
    recurrenceType: z.string().optional(),
    // Chave S3/R2 do anexo original (PDF/imagem do orçamento) — preenchido
    // quando o usuário sobe um arquivo via "Adicione o Orçamento aqui" no
    // BudgetPanel. Permite ver/baixar o arquivo no histórico.
    attachmentUrl: z.string().optional(),
    // Toggle "Exigir aprovação" no form (Governança Fase 2).
    requiresApproval: z.boolean().default(false),
    // Régua de cobrança (Fase 2) — só faz sentido em RECEIVABLE.
    dunningRuleId: z.string().optional(),
    // Anexos já enviados pelo form (spec 0008). Vinculados depois do commit,
    // a TODAS as parcelas criadas — ver `linkAttachmentsToEntries`.
    attachmentIds: z.array(z.string()).optional(),
  }))
  .output(z.object({ entries: z.array(entryShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const entries = await createPaymentEntryRecord({
        organizationId: context.org.id,
        actor: context.user,
        input,
      });
      return { entries };
    } catch (err) {
      console.error("[payment/entries create]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updatePaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "PATCH", summary: "Update payment entry", tags: ["Payment"] })
  .input(z.object({
    id: z.string(),
    description: z.string().trim().min(1, "Informe uma descrição").optional(),
    amount: z.number().int().positive("O valor precisa ser maior que zero").optional(),
    dueDate: z.string().refine(isValidDateValue, "Data de vencimento inválida").optional(),
    status: entryStatusSchema.optional(),
    paidAmount: z.number().optional(),
    paidAt: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    costCenterId: z.string().nullable().optional(),
    contactId: z.string().nullable().optional(),
    accountId: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    documentNumber: z.string().nullable().optional(),
    installmentTotal: z.number().int().positive().nullable().optional(),
    installmentCurrent: z.number().int().positive().nullable().optional(),
  }))
  .output(z.object({ entry: entryShape }))
  .handler(async ({ input, context, errors }) => {
    const { id, ...patch } = input;
    let result;
    try {
      result = await updatePaymentEntryRecord({
        organizationId: context.org.id,
        entryId: id,
        patch,
      });
    } catch (err) {
      console.error("[payment/entries update]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    // Sem isso, uma entry de outra organização (ou já excluída) caía no catch
    // e virava "Something went wrong".
    if (!result.ok) {
      if (result.reason === "over_amount") {
        throw errors.BAD_REQUEST({ message: result.message });
      }
      throw errors.NOT_FOUND({ message: result.message });
    }
    return { entry: result.entry };
  });

export const generatePaymentEntryInstallments = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "create"))
  .route({ method: "POST", summary: "Generate the remaining installments", tags: ["Payment"] })
  .input(z.object({
    id: z.string(),
    installmentTotal: z.number().int().min(2).max(MAX_INSTALLMENTS),
  }))
  .output(z.object({ createdCount: z.number(), installmentTotal: z.number() }))
  .handler(async ({ input, context, errors }) => {
    let result;
    try {
      result = await generateEntryInstallments({
        organizationId: context.org.id,
        actor: context.user,
        entryId: input.id,
        installmentTotal: input.installmentTotal,
      });
    } catch (err) {
      console.error("[payment/entries generateInstallments]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!result.ok) {
      if (result.reason === "not_found") throw errors.NOT_FOUND({ message: result.message });
      throw errors.BAD_REQUEST({ message: result.message });
    }
    return { createdCount: result.createdCount, installmentTotal: result.installmentTotal };
  });

export const payPaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Pay payment entry", tags: ["Payment"] })
  .input(z.object({
    id: z.string(),
    paidAmount: z.number().int().positive("O valor pago precisa ser maior que zero"),
    paidAt: z.string().optional(),
    accountId: z.string().optional(),
  }))
  .output(z.object({ entry: entryShape }))
  .handler(async ({ input, context, errors }) => {
    let result;
    try {
      result = await payPaymentEntryRecord({
        organizationId: context.org.id,
        actor: context.user,
        entryId: input.id,
        paidAmountCents: input.paidAmount,
        paidAt: input.paidAt,
        accountId: input.accountId,
      });
    } catch (err) {
      console.error("[payment/entries pay]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!result.ok) {
      // Fora do try de propósito: o catch converteria em INTERNAL_SERVER_ERROR
      // e o usuário veria "erro ao registrar" no lugar da causa real.
      if (result.reason === "not_found") throw errors.NOT_FOUND({ message: result.message });
      throw errors.BAD_REQUEST({ message: result.message });
    }
    return { entry: result.entry };
  });

export const deletePaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "delete"))
  .route({ method: "DELETE", summary: "Cancel payment entry (soft)", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.paymentEntry.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Lançamento não encontrado" });
    }
    if (existing.status === "CANCELLED") {
      throw errors.BAD_REQUEST({ message: "Lançamento já está cancelado" });
    }

    try {
      await prisma.paymentEntry.update({
        where: { id: input.id },
        data: { status: "CANCELLED" },
      });
      return { ok: true };
    } catch (err) {
      console.error("[payment/entries cancel]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// Hard delete — remove a entry do banco de vez. As relações filhas
// (PaymentApprovalRequest, PaymentDunningExecution) são onDelete: Cascade,
// então o Prisma limpa os filhos automaticamente. Diferente do soft-cancel,
// aqui registramos activity log por ser destrutivo/irreversível.
export const removePaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "delete"))
  .route({ method: "DELETE", summary: "Hard-delete payment entry", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.paymentEntry.findFirst({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Lançamento não encontrado" });
    }

    try {
      await prisma.paymentEntry.delete({
        where: { id: input.id, organizationId: context.org.id },
      });

      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as { image?: string | null }).image,
        appSlug: "payment",
        subAppSlug: "payment-entries",
        featureKey: "payment.entry.deleted",
        action: "payment.entry.deleted",
        actionLabel: `Excluiu "${existing.description}" (${formatCents(existing.amount)})`,
        resource: existing.description,
        resourceId: existing.id,
        metadata: { amount: existing.amount, type: existing.type },
      });

      return { ok: true };
    } catch (err) {
      console.error("[payment/entries remove]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
