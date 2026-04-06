import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const accountShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  bankName: z.string().nullable(),
  bankCode: z.string().nullable(),
  agency: z.string().nullable(),
  account: z.string().nullable(),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "DIGITAL"]),
  balance: z.number(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  color: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listPaymentAccounts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List payment bank accounts", tags: ["Payment"] })
  .input(z.object({}))
  .output(z.object({ accounts: z.array(accountShape) }))
  .handler(async ({ context, errors }) => {
    try {
      const accounts = await prisma.paymentBankAccount.findMany({
        where: { organizationId: context.org.id, isActive: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });
      return { accounts };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createPaymentAccount = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Create payment bank account", tags: ["Payment"] })
  .input(z.object({
    name: z.string(),
    bankName: z.string().optional(),
    bankCode: z.string().optional(),
    agency: z.string().optional(),
    account: z.string().optional(),
    type: z.enum(["CHECKING", "SAVINGS", "CASH", "DIGITAL"]).default("CHECKING"),
    balance: z.number().default(0),
    color: z.string().optional(),
    isDefault: z.boolean().default(false),
  }))
  .output(z.object({ account: accountShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      if (input.isDefault) {
        await prisma.paymentBankAccount.updateMany({
          where: { organizationId: context.org.id },
          data: { isDefault: false },
        });
      }
      const account = await prisma.paymentBankAccount.create({
        data: { ...input, organizationId: context.org.id },
      });
      return { account };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updatePaymentAccount = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PATCH", summary: "Update payment bank account", tags: ["Payment"] })
  .input(z.object({
    id: z.string(),
    name: z.string().optional(),
    bankName: z.string().nullable().optional(),
    bankCode: z.string().nullable().optional(),
    agency: z.string().nullable().optional(),
    account: z.string().nullable().optional(),
    type: z.enum(["CHECKING", "SAVINGS", "CASH", "DIGITAL"]).optional(),
    balance: z.number().optional(),
    color: z.string().nullable().optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }))
  .output(z.object({ account: accountShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const { id, ...data } = input;
      if (data.isDefault) {
        await prisma.paymentBankAccount.updateMany({
          where: { organizationId: context.org.id },
          data: { isDefault: false },
        });
      }
      const account = await prisma.paymentBankAccount.update({
        where: { id, organizationId: context.org.id },
        data,
      });
      return { account };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deletePaymentAccount = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "DELETE", summary: "Delete payment bank account", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.paymentBankAccount.update({
        where: { id: input.id, organizationId: context.org.id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
