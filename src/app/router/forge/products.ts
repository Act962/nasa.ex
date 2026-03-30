import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const productShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  sku: z.string(),
  imageUrl: z.string().nullable(),
  unit: z.string(),
  description: z.string().nullable(),
  value: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listForgeProducts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List forge products", tags: ["Forge"] })
  .input(z.object({ search: z.string().optional() }))
  .output(z.object({ products: z.array(productShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const products = await prisma.forgeProduct.findMany({
        where: {
          organizationId: context.org.id,
          ...(input.search
            ? {
                OR: [
                  { name: { contains: input.search, mode: "insensitive" } },
                  { sku: { contains: input.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      });
      return { products: products.map((p) => ({ ...p, value: p.value.toString() })) };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createForgeProduct = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Create forge product", tags: ["Forge"] })
  .input(
    z.object({
      name: z.string(),
      sku: z.string(),
      imageUrl: z.string().optional(),
      unit: z.string().default("un"),
      description: z.string().optional(),
      value: z.string(),
    }),
  )
  .output(z.object({ product: productShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const product = await prisma.forgeProduct.create({
        data: {
          organizationId: context.org.id,
          name: input.name,
          sku: input.sku,
          imageUrl: input.imageUrl && input.imageUrl.trim() !== "" ? input.imageUrl : null,
          unit: input.unit,
          description: input.description && input.description.trim() !== "" ? input.description : null,
          value: input.value,
          createdById: context.user.id,
        },
      });
      return { product: { ...product, value: product.value.toString() } };
    } catch (err) {
      console.error("[forge/products create]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updateForgeProduct = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PATCH", summary: "Update forge product", tags: ["Forge"] })
  .input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      sku: z.string().optional(),
      imageUrl: z.string().nullable().optional(),
      unit: z.string().optional(),
      description: z.string().nullable().optional(),
      value: z.string().optional(),
    }),
  )
  .output(z.object({ product: productShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const product = await prisma.forgeProduct.update({
        where: { id: input.id, organizationId: context.org.id },
        data: {
          name: input.name,
          sku: input.sku,
          imageUrl: input.imageUrl,
          unit: input.unit,
          description: input.description,
          value: input.value,
        },
      });
      return { product: { ...product, value: product.value.toString() } };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deleteForgeProduct = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "DELETE", summary: "Delete forge product", tags: ["Forge"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.forgeProduct.delete({
        where: { id: input.id, organizationId: context.org.id },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
