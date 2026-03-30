import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const contractShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  proposalId: z.string().nullable(),
  number: z.number(),
  startDate: z.date(),
  endDate: z.date(),
  value: z.string(),
  status: z.string(),
  templateId: z.string().nullable(),
  content: z.string().nullable(),
  signers: z.any(),
  createdById: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  proposal: z.object({ id: z.string(), title: z.string(), number: z.number() }).nullable(),
  template: z.object({ id: z.string(), name: z.string() }).nullable(),
});

export const listForgeContracts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List forge contracts", tags: ["Forge"] })
  .input(z.object({ status: z.string().optional() }))
  .output(z.object({ contracts: z.array(contractShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const contracts = await prisma.forgeContract.findMany({
        where: {
          organizationId: context.org.id,
          ...(input.status ? { status: input.status as never } : {}),
        },
        include: {
          proposal: { select: { id: true, title: true, number: true } },
          template: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return { contracts: contracts.map((c) => ({ ...c, value: c.value.toString() })) };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createForgeContract = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Create forge contract", tags: ["Forge"] })
  .input(
    z.object({
      proposalId: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
      value: z.string(),
      templateId: z.string().optional(),
      content: z.string().optional(),
      signers: z.array(z.object({
        name: z.string(),
        email: z.string(),
        whatsapp: z.string().optional(),
      })).default([]),
    }),
  )
  .output(z.object({ contract: z.object({ id: z.string(), number: z.number() }) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const contract = await prisma.$transaction(async (tx) => {
        const last = await tx.forgeContract.findFirst({
          where: { organizationId: context.org.id },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;

        return tx.forgeContract.create({
          data: {
            organizationId: context.org.id,
            proposalId: input.proposalId,
            number,
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
            value: input.value,
            templateId: input.templateId,
            content: input.content,
            signers: input.signers.map((s) => ({ ...s, signed_at: null, token: crypto.randomUUID() })),
            createdById: context.user.id,
          },
          select: { id: true, number: true },
        });
      });
      return { contract };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updateForgeContract = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PATCH", summary: "Update forge contract", tags: ["Forge"] })
  .input(
    z.object({
      id: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      value: z.string().optional(),
      status: z.string().optional(),
      templateId: z.string().nullable().optional(),
      content: z.string().nullable().optional(),
      signers: z.any().optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.forgeContract.update({
        where: { id: input.id, organizationId: context.org.id },
        data: {
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          value: input.value,
          status: input.status as never,
          templateId: input.templateId,
          content: input.content,
          signers: input.signers,
        },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deleteForgeContract = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "DELETE", summary: "Delete forge contract", tags: ["Forge"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.forgeContract.delete({
        where: { id: input.id, organizationId: context.org.id },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
