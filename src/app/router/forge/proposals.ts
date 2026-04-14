import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { inngest } from "@/inngest/client";

const proposalProductShape = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.string(),
  unitValue: z.string(),
  discount: z.string().nullable(),
  description: z.string().nullable(),
  order: z.number(),
  product: z.object({ id: z.string(), name: z.string(), unit: z.string(), imageUrl: z.string().nullable() }),
});

const proposalShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  title: z.string(),
  number: z.number(),
  status: z.string(),
  clientId: z.string().nullable(),
  responsibleId: z.string(),
  participants: z.array(z.string()),
  validUntil: z.date().nullable(),
  description: z.string().nullable(),
  discount: z.string().nullable(),
  discountType: z.string().nullable(),
  paymentLink: z.string().nullable(),
  paymentGateway: z.string().nullable(),
  publicToken: z.string(),
  headerConfig: z.any(),
  isTemplate: z.boolean(),
  templateMarkedByModerator: z.boolean(),
  createdById: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  client: z.object({ id: z.string(), name: z.string(), email: z.string().nullable(), phone: z.string().nullable() }).nullable(),
  responsible: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  products: z.array(proposalProductShape),
});

export const listForgeProposals = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List forge proposals", tags: ["Forge"] })
  .input(
    z.object({
      status: z.string().optional(),
      responsibleId: z.string().optional(),
    }),
  )
  .output(z.object({ proposals: z.array(proposalShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const proposals = await prisma.forgeProposal.findMany({
        where: {
          organizationId: context.org.id,
          ...(input.status ? { status: input.status as never } : {}),
          ...(input.responsibleId ? { responsibleId: input.responsibleId } : {}),
        },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          responsible: { select: { id: true, name: true, email: true } },
          products: {
            include: { product: { select: { id: true, name: true, unit: true, imageUrl: true } } },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        proposals: proposals.map((p) => ({
          ...p,
          discount: p.discount?.toString() ?? null,
          products: p.products.map((pp) => ({
            ...pp,
            quantity: pp.quantity.toString(),
            unitValue: pp.unitValue.toString(),
            discount: pp.discount?.toString() ?? null,
          })),
        })),
      };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const getForgeProposal = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get forge proposal", tags: ["Forge"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ proposal: proposalShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const proposal = await prisma.forgeProposal.findFirst({
        where: { id: input.id, organizationId: context.org.id },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          responsible: { select: { id: true, name: true, email: true } },
          products: {
            include: { product: { select: { id: true, name: true, unit: true, imageUrl: true } } },
            orderBy: { order: "asc" },
          },
        },
      });
      if (!proposal) throw errors.NOT_FOUND;
      return {
        proposal: {
          ...proposal,
          discount: proposal.discount?.toString() ?? null,
          products: proposal.products.map((pp) => ({
            ...pp,
            quantity: pp.quantity.toString(),
            unitValue: pp.unitValue.toString(),
            discount: pp.discount?.toString() ?? null,
          })),
        },
      };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createForgeProposal = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Create forge proposal", tags: ["Forge"] })
  .input(
    z.object({
      title: z.string(),
      clientId: z.string().optional(),
      responsibleId: z.string(),
      participants: z.array(z.string()).default([]),
      validUntil: z.string().optional(),
      description: z.string().optional(),
      discount: z.string().optional(),
      discountType: z.enum(["PERCENTUAL", "FIXO"]).optional(),
      paymentLink: z.string().optional(),
      paymentGateway: z.string().optional(),
      headerConfig: z.record(z.string(), z.unknown()).optional(),
      products: z
        .array(
          z.object({
            productId: z.string(),
            quantity: z.string(),
            unitValue: z.string(),
            discount: z.string().optional(),
            description: z.string().optional(),
            order: z.number().default(0),
          }),
        )
        .default([]),
    }),
  )
  .output(z.object({ proposal: z.object({ id: z.string(), number: z.number() }) }))
  .handler(async ({ input, context, errors }) => {
    try {
      // Helpers to clean blank form strings → null/undefined
      const strOrNull = (v?: string | null) => (v && v.trim() !== "" ? v : null);
      const strOrUndef = (v?: string | null) => (v && v.trim() !== "" ? v : undefined);

      const proposal = await prisma.$transaction(async (tx) => {
        const last = await tx.forgeProposal.findFirst({
          where: { organizationId: context.org.id },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;

        return tx.forgeProposal.create({
          data: {
            organizationId: context.org.id,
            title: input.title,
            number,
            clientId: strOrNull(input.clientId),
            responsibleId: input.responsibleId,
            participants: input.participants,
            validUntil: input.validUntil && input.validUntil.trim() !== "" ? new Date(input.validUntil) : null,
            description: strOrNull(input.description),
            discount: strOrNull(input.discount),
            discountType: strOrUndef(input.discountType) as never,
            paymentLink: strOrNull(input.paymentLink),
            paymentGateway: strOrUndef(input.paymentGateway) as never,
            headerConfig: (input.headerConfig ?? {}) as Prisma.InputJsonValue,
            createdById: context.user.id,
            products: {
              create: input.products
                .filter((pp) => pp.productId && pp.productId.trim() !== "")
                .map((pp) => ({
                  productId: pp.productId,
                  quantity: pp.quantity && pp.quantity.trim() !== "" ? pp.quantity : "1",
                  unitValue: pp.unitValue && pp.unitValue.trim() !== "" ? pp.unitValue : "0",
                  discount: strOrNull(pp.discount),
                  description: strOrNull(pp.description),
                  order: pp.order,
                })),
            },
          },
          select: { id: true, number: true },
        });
      });
      return { proposal };
    } catch (err) {
      console.error("[forge/proposals create]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updateForgeProposal = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PATCH", summary: "Update forge proposal", tags: ["Forge"] })
  .input(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      clientId: z.string().nullable().optional(),
      responsibleId: z.string().optional(),
      participants: z.array(z.string()).optional(),
      validUntil: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      discount: z.string().nullable().optional(),
      discountType: z.enum(["PERCENTUAL", "FIXO"]).nullable().optional(),
      paymentLink: z.string().nullable().optional(),
      paymentGateway: z.string().nullable().optional(),
      headerConfig: z.record(z.string(), z.unknown()).optional(),
      status: z.string().optional(),
      products: z
        .array(
          z.object({
            productId: z.string(),
            quantity: z.string(),
            unitValue: z.string(),
            discount: z.string().optional(),
            description: z.string().optional(),
            order: z.number().default(0),
          }),
        )
        .optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const strOrNull = (v?: string | null) => (v !== undefined ? (v && v.trim() !== "" ? v : null) : undefined);
      const strOrUndef = (v?: string | null) => (v && v.trim() !== "" ? v : undefined);

      await prisma.$transaction(async (tx) => {
        await tx.forgeProposal.update({
          where: { id: input.id, organizationId: context.org.id },
          data: {
            title: input.title,
            clientId: input.clientId !== undefined ? strOrNull(input.clientId) : undefined,
            responsibleId: input.responsibleId,
            participants: input.participants,
            validUntil:
              input.validUntil !== undefined
                ? input.validUntil && input.validUntil.trim() !== ""
                  ? new Date(input.validUntil)
                  : null
                : undefined,
            description: input.description !== undefined ? strOrNull(input.description) : undefined,
            discount: input.discount !== undefined ? strOrNull(input.discount) : undefined,
            discountType: input.discountType !== undefined ? (strOrUndef(input.discountType) as never) : undefined,
            paymentLink: input.paymentLink !== undefined ? strOrNull(input.paymentLink) : undefined,
            paymentGateway: input.paymentGateway !== undefined ? (strOrUndef(input.paymentGateway) as never) : undefined,
            headerConfig: input.headerConfig !== undefined
              ? (input.headerConfig as Prisma.InputJsonValue)
              : undefined,
            status: strOrUndef(input.status) as never,
          },
        });
        if (input.products !== undefined) {
          await tx.forgeProposalProduct.deleteMany({ where: { proposalId: input.id } });
          const validProducts = input.products.filter((pp) => pp.productId && pp.productId.trim() !== "");
          if (validProducts.length > 0) {
            await tx.forgeProposalProduct.createMany({
              data: validProducts.map((pp) => ({
                proposalId: input.id,
                productId: pp.productId,
                quantity: pp.quantity && pp.quantity.trim() !== "" ? pp.quantity : "1",
                unitValue: pp.unitValue && pp.unitValue.trim() !== "" ? pp.unitValue : "0",
                discount: pp.discount && pp.discount.trim() !== "" ? pp.discount : null,
                description: pp.description && pp.description.trim() !== "" ? pp.description : null,
                order: pp.order,
              })),
            });
          }
        }
      });

      // Disparar automação de onboarding quando proposta for paga
      if (input.status === "PAGA") {
        try {
          const updated = await prisma.forgeProposal.findUnique({
            where: { id: input.id },
            select: { id: true, organizationId: true, clientId: true, orgProjectId: true },
          });
          if (updated) {
            await inngest.send({
              name: "onboarding/proposal.paid",
              data: {
                proposalId: updated.id,
                organizationId: updated.organizationId,
                leadId: updated.clientId,
                orgProjectId: updated.orgProjectId,
              },
            });
          }
        } catch (inngestErr) {
          console.error("[forge/proposals] Inngest send error:", inngestErr);
          // não bloqueia — onboarding é best-effort
        }
      }

      return { ok: true };
    } catch (err) {
      console.error("[forge/proposals update]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deleteForgeProposal = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "DELETE", summary: "Delete forge proposal", tags: ["Forge"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.forgeProposal.delete({
        where: { id: input.id, organizationId: context.org.id },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// Public route — no auth
export const getForgeProposalPublic = base
  .route({ method: "GET", summary: "Get public forge proposal", tags: ["Forge"] })
  .input(z.object({ token: z.string() }))
  .output(z.object({ proposal: z.any() }))
  .handler(async ({ input, errors }) => {
    try {
      const proposal = await prisma.forgeProposal.findUnique({
        where: { publicToken: input.token },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          organization: { select: { id: true, name: true, logo: true } },
          products: {
            include: { product: { select: { id: true, name: true, unit: true, imageUrl: true } } },
            orderBy: { order: "asc" },
          },
        },
      });
      if (!proposal) throw errors.NOT_FOUND;
      return { proposal };
    } catch {
      throw errors.NOT_FOUND;
    }
  });
