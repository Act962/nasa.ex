import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { randomUUID } from "crypto";

const entryShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  status: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]),
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
  installmentTotal: z.number().nullable(),
  installmentCurrent: z.number().nullable(),
  installmentGroupId: z.string().nullable(),
  isRecurring: z.boolean(),
  recurrenceType: z.string().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  category: z.object({ id: z.string(), name: z.string(), type: z.string(), color: z.string().nullable() }).nullable(),
  contact: z.object({ id: z.string(), name: z.string(), contactType: z.string() }).nullable(),
  account: z.object({ id: z.string(), name: z.string(), type: z.string() }).nullable(),
});

const entryInclude = {
  category: { select: { id: true, name: true, type: true, color: true } },
  contact: { select: { id: true, name: true, contactType: true } },
  account: { select: { id: true, name: true, type: true } },
};

export const listPaymentEntries = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List payment entries", tags: ["Payment"] })
  .input(z.object({
    type: z.enum(["RECEIVABLE", "PAYABLE"]).optional(),
    status: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]).optional(),
    contactId: z.string().optional(),
    categoryId: z.string().optional(),
    accountId: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    search: z.string().optional(),
    page: z.number().default(1),
    perPage: z.number().default(50),
  }))
  .output(z.object({
    entries: z.array(entryShape),
    total: z.number(),
  }))
  .handler(async ({ input, context, errors }) => {
    try {
      const where = {
        organizationId: context.org.id,
        ...(input.type ? { type: input.type } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.contactId ? { contactId: input.contactId } : {}),
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.accountId ? { accountId: input.accountId } : {}),
        ...(input.search ? { description: { contains: input.search, mode: "insensitive" as const } } : {}),
        ...(input.dateFrom || input.dateTo
          ? {
              dueDate: {
                ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
                ...(input.dateTo ? { lte: new Date(input.dateTo) } : {}),
              },
            }
          : {}),
      };
      const [entries, total] = await Promise.all([
        prisma.paymentEntry.findMany({
          where,
          include: entryInclude,
          orderBy: { dueDate: "asc" },
          skip: (input.page - 1) * input.perPage,
          take: input.perPage,
        }),
        prisma.paymentEntry.count({ where }),
      ]);
      return { entries, total };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createPaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Create payment entry", tags: ["Payment"] })
  .input(z.object({
    type: z.enum(["RECEIVABLE", "PAYABLE"]),
    description: z.string(),
    amount: z.number(),
    dueDate: z.string(),
    categoryId: z.string().optional(),
    costCenterId: z.string().optional(),
    contactId: z.string().optional(),
    accountId: z.string().optional(),
    notes: z.string().optional(),
    documentNumber: z.string().optional(),
    competenceDate: z.string().optional(),
    installments: z.number().default(1),
    isRecurring: z.boolean().default(false),
    recurrenceType: z.string().optional(),
  }))
  .output(z.object({ entries: z.array(entryShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const { installments, dueDate, competenceDate, ...rest } = input;
      const groupId = installments > 1 ? randomUUID() : undefined;
      const baseDate = new Date(dueDate);

      const data = Array.from({ length: installments }, (_, i) => {
        const due = new Date(baseDate);
        due.setMonth(due.getMonth() + i);
        return {
          ...rest,
          organizationId: context.org.id,
          createdById: context.user.id,
          dueDate: due,
          competenceDate: competenceDate ? new Date(competenceDate) : null,
          installmentTotal: installments > 1 ? installments : null,
          installmentCurrent: installments > 1 ? i + 1 : null,
          installmentGroupId: groupId ?? null,
        };
      });

      const entries = await prisma.$transaction(
        data.map((d) => prisma.paymentEntry.create({ data: d, include: entryInclude }))
      );

      return { entries };
    } catch (err) {
      console.error("[payment/entries create]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updatePaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PATCH", summary: "Update payment entry", tags: ["Payment"] })
  .input(z.object({
    id: z.string(),
    description: z.string().optional(),
    amount: z.number().optional(),
    dueDate: z.string().optional(),
    status: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]).optional(),
    paidAmount: z.number().optional(),
    paidAt: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    costCenterId: z.string().nullable().optional(),
    contactId: z.string().nullable().optional(),
    accountId: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    documentNumber: z.string().nullable().optional(),
  }))
  .output(z.object({ entry: entryShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const { id, dueDate, paidAt, ...data } = input;
      const entry = await prisma.paymentEntry.update({
        where: { id, organizationId: context.org.id },
        data: {
          ...data,
          ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
          ...(paidAt !== undefined ? { paidAt: paidAt ? new Date(paidAt) : null } : {}),
        },
        include: entryInclude,
      });
      return { entry };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const payPaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Pay payment entry", tags: ["Payment"] })
  .input(z.object({
    id: z.string(),
    paidAmount: z.number(),
    paidAt: z.string().optional(),
    accountId: z.string().optional(),
  }))
  .output(z.object({ entry: entryShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const existing = await prisma.paymentEntry.findFirst({
        where: { id: input.id, organizationId: context.org.id },
      });
      if (!existing) throw errors.NOT_FOUND;

      const newPaid = existing.paidAmount + input.paidAmount;
      const status = newPaid >= existing.amount ? "PAID" : "PARTIAL";

      const entry = await prisma.paymentEntry.update({
        where: { id: input.id },
        data: {
          paidAmount: newPaid,
          status,
          paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
          ...(input.accountId ? { accountId: input.accountId } : {}),
        },
        include: entryInclude,
      });

      return { entry };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deletePaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "DELETE", summary: "Delete payment entry", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.paymentEntry.update({
        where: { id: input.id, organizationId: context.org.id },
        data: { status: "CANCELLED" },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
