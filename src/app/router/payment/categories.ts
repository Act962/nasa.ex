import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const categoryShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  type: z.enum(["REVENUE", "EXPENSE", "COST"]),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  parentId: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listPaymentCategories = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List payment categories", tags: ["Payment"] })
  .input(z.object({ type: z.enum(["REVENUE", "EXPENSE", "COST"]).optional() }))
  .output(z.object({ categories: z.array(categoryShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const categories = await prisma.paymentCategory.findMany({
        where: {
          organizationId: context.org.id,
          isActive: true,
          ...(input.type ? { type: input.type } : {}),
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      });
      return { categories };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createPaymentCategory = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Create payment category", tags: ["Payment"] })
  .input(z.object({
    name: z.string(),
    type: z.enum(["REVENUE", "EXPENSE", "COST"]),
    color: z.string().optional(),
    icon: z.string().optional(),
    parentId: z.string().optional(),
  }))
  .output(z.object({ category: categoryShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const category = await prisma.paymentCategory.create({
        data: { ...input, organizationId: context.org.id },
      });
      return { category };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updatePaymentCategory = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PATCH", summary: "Update payment category", tags: ["Payment"] })
  .input(z.object({
    id: z.string(),
    name: z.string().optional(),
    type: z.enum(["REVENUE", "EXPENSE", "COST"]).optional(),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
  }))
  .output(z.object({ category: categoryShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const { id, ...data } = input;
      const category = await prisma.paymentCategory.update({
        where: { id, organizationId: context.org.id },
        data,
      });
      return { category };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deletePaymentCategory = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "DELETE", summary: "Delete payment category", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.paymentCategory.update({
        where: { id: input.id, organizationId: context.org.id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
