import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireSystemAdminMiddleware } from "@/app/middlewares/system-admin";
import prisma from "@/lib/prisma";
import type { ForgePriceItem } from "@/generated/prisma/client";
import { seedForgePriceCatalog } from "@/features/forge/lib/seed-price-catalog";
import {
  priceCategorySchema,
  priceCurrencySchema,
  priceUnitSchema,
} from "@/features/forge/schema/simulator-schema";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

/**
 * O índice único é (organização, categoria, código). Sem este tratamento o
 * P2002 caía no catch genérico e o admin via "Internal server error" ao
 * repetir um código que já existe.
 */
function isDuplicateCodeError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

const DUPLICATE_CODE_MESSAGE =
  "Já existe um item com esse código nesta categoria. Use outro código ou edite o item existente.";

const priceItemShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  category: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  provider: z.string().nullable(),
  currency: z.string(),
  unit: z.string(),
  unitPrice: z.string().nullable(),
  inputPer1k: z.string().nullable(),
  outputPer1k: z.string().nullable(),
  cachedInputPer1k: z.string().nullable(),
  metadata: z.any(),
  isActive: z.boolean(),
  isSeeded: z.boolean(),
  source: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

type SerializedPriceItem = z.infer<typeof priceItemShape>;

const decimalToString = (value: unknown): string | null =>
  value === null || value === undefined ? null : value.toString();

const serializePriceItem = (item: ForgePriceItem): SerializedPriceItem => ({
  ...item,
  unitPrice: decimalToString(item.unitPrice),
  inputPer1k: decimalToString(item.inputPer1k),
  outputPer1k: decimalToString(item.outputPer1k),
  cachedInputPer1k: decimalToString(item.cachedInputPer1k),
});

export const listForgePriceItems = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "GET", summary: "List forge price catalog", tags: ["Forge"] })
  .input(
    z.object({
      category: priceCategorySchema.optional(),
      search: z.string().optional(),
      activeOnly: z.boolean().optional(),
    }),
  )
  .output(z.object({ items: z.array(priceItemShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const existing = await prisma.forgePriceItem.count({
        where: { organizationId: context.org.id },
      });
      if (existing === 0) {
        await seedForgePriceCatalog(prisma, context.org.id);
      }

      const items = await prisma.forgePriceItem.findMany({
        where: {
          organizationId: context.org.id,
          ...(input.category ? { category: input.category } : {}),
          ...(input.activeOnly ? { isActive: true } : {}),
          ...(input.search
            ? {
                OR: [
                  { name: { contains: input.search, mode: "insensitive" } },
                  { code: { contains: input.search, mode: "insensitive" } },
                  { provider: { contains: input.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      });
      return { items: items.map(serializePriceItem) };
    } catch (err) {
      console.error("[forge/price-catalog list]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

const priceItemWriteInput = z.object({
  category: priceCategorySchema,
  name: z.string().min(1),
  code: z.string().nullish(),
  description: z.string().nullish(),
  provider: z.string().nullish(),
  currency: priceCurrencySchema.default("BRL"),
  unit: priceUnitSchema,
  unitPrice: z.string().nullish(),
  inputPer1k: z.string().nullish(),
  outputPer1k: z.string().nullish(),
  cachedInputPer1k: z.string().nullish(),
  metadata: z.any().optional(),
  sortOrder: z.number().int().optional(),
});

export const createForgePriceItem = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "POST", summary: "Create forge price item", tags: ["Forge"] })
  .input(priceItemWriteInput)
  .output(z.object({ item: priceItemShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const item = await prisma.forgePriceItem.create({
        data: {
          organizationId: context.org.id,
          category: input.category,
          name: input.name,
          code: input.code ?? null,
          description: input.description ?? null,
          provider: input.provider ?? null,
          currency: input.currency,
          unit: input.unit,
          unitPrice: input.unitPrice ?? null,
          inputPer1k: input.inputPer1k ?? null,
          outputPer1k: input.outputPer1k ?? null,
          cachedInputPer1k: input.cachedInputPer1k ?? null,
          metadata: input.metadata ?? {},
          source: "manual",
          sortOrder: input.sortOrder ?? 0,
          createdById: context.user.id,
        },
      });
      return { item: serializePriceItem(item) };
    } catch (err) {
      if (isDuplicateCodeError(err)) {
        throw new ORPCError("CONFLICT", { message: DUPLICATE_CODE_MESSAGE });
      }
      console.error("[forge/price-catalog create]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updateForgePriceItem = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "PATCH", summary: "Update forge price item", tags: ["Forge"] })
  .input(priceItemWriteInput.partial().extend({ id: z.string(), isActive: z.boolean().optional() }))
  .output(z.object({ item: priceItemShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const { id, ...rest } = input;
      const item = await prisma.forgePriceItem.update({
        where: { id, organizationId: context.org.id },
        data: {
          category: rest.category,
          name: rest.name,
          code: rest.code,
          description: rest.description,
          provider: rest.provider,
          currency: rest.currency,
          unit: rest.unit,
          unitPrice: rest.unitPrice,
          inputPer1k: rest.inputPer1k,
          outputPer1k: rest.outputPer1k,
          cachedInputPer1k: rest.cachedInputPer1k,
          metadata: rest.metadata,
          sortOrder: rest.sortOrder,
          isActive: rest.isActive,
        },
      });
      return { item: serializePriceItem(item) };
    } catch (err) {
      if (isDuplicateCodeError(err)) {
        throw new ORPCError("CONFLICT", { message: DUPLICATE_CODE_MESSAGE });
      }
      console.error("[forge/price-catalog update]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deleteForgePriceItem = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "DELETE", summary: "Deactivate forge price item", tags: ["Forge"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      // Soft-delete: preserva snapshots de simulações que referenciam o item.
      await prisma.forgePriceItem.update({
        where: { id: input.id, organizationId: context.org.id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

const suggestionShape = z.object({
  id: z.string(),
  priceItemId: z.string().nullable(),
  category: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  currency: z.string(),
  currentValue: z.any(),
  suggestedValue: z.any(),
  sourceUrl: z.string().nullable(),
  sourceLabel: z.string().nullable(),
  fetchedAt: z.date(),
  status: z.string(),
  createdAt: z.date(),
});

export const listForgePriceSuggestions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "GET", summary: "List forge price suggestions", tags: ["Forge"] })
  .input(z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional() }))
  .output(z.object({ suggestions: z.array(suggestionShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const suggestions = await prisma.forgePriceSuggestion.findMany({
        where: {
          organizationId: context.org.id,
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { fetchedAt: "desc" },
      });
      return { suggestions };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const reviewForgePriceSuggestion = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "POST", summary: "Review forge price suggestion", tags: ["Forge"] })
  .input(z.object({ id: z.string(), action: z.enum(["APPROVE", "REJECT"]) }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const suggestion = await prisma.forgePriceSuggestion.findFirst({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (!suggestion) throw errors.NOT_FOUND;

    try {
      await prisma.$transaction(async (tx) => {
        if (input.action === "APPROVE") {
          const value = (suggestion.suggestedValue ?? {}) as Record<string, unknown>;
          if (suggestion.priceItemId) {
            await tx.forgePriceItem.update({
              where: { id: suggestion.priceItemId },
              data: {
                unitPrice: (value.unitPrice as string | undefined) ?? undefined,
                inputPer1k: (value.inputPer1k as string | undefined) ?? undefined,
                outputPer1k: (value.outputPer1k as string | undefined) ?? undefined,
                cachedInputPer1k: (value.cachedInputPer1k as string | undefined) ?? undefined,
                source: "suggestion",
              },
            });
          } else {
            await tx.forgePriceItem.create({
              data: {
                organizationId: context.org.id,
                category: suggestion.category,
                name: suggestion.name,
                code: suggestion.code,
                currency: suggestion.currency,
                unit: (value.unit as string | undefined) ?? "FLAT",
                unitPrice: (value.unitPrice as string | undefined) ?? null,
                inputPer1k: (value.inputPer1k as string | undefined) ?? null,
                outputPer1k: (value.outputPer1k as string | undefined) ?? null,
                cachedInputPer1k: (value.cachedInputPer1k as string | undefined) ?? null,
                source: "suggestion",
              } as never,
            });
          }
        }

        await tx.forgePriceSuggestion.update({
          where: { id: suggestion.id },
          data: {
            status: input.action === "APPROVE" ? "APPROVED" : "REJECTED",
            reviewedById: context.user.id,
            reviewedAt: new Date(),
          },
        });
      });
      return { ok: true };
    } catch (err) {
      console.error("[forge/price-catalog review]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
