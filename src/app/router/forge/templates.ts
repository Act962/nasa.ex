import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const templateShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  content: z.string(),
  defaultStartDate: z.date().nullable(),
  defaultEndDate: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listForgeTemplates = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List contract templates", tags: ["Forge"] })
  .input(z.object({}))
  .output(z.object({ templates: z.array(templateShape) }))
  .handler(async ({ context, errors }) => {
    try {
      const templates = await prisma.forgeContractTemplate.findMany({
        where: { organizationId: context.org.id },
        orderBy: { createdAt: "desc" },
      });
      return { templates };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createForgeTemplate = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Create contract template", tags: ["Forge"] })
  .input(z.object({
    name: z.string(),
    content: z.string(),
    defaultStartDate: z.string().nullable().optional(),
    defaultEndDate: z.string().nullable().optional(),
  }))
  .output(z.object({ template: templateShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const template = await prisma.forgeContractTemplate.create({
        data: {
          organizationId: context.org.id,
          name: input.name,
          content: input.content,
          defaultStartDate: input.defaultStartDate ? new Date(input.defaultStartDate) : null,
          defaultEndDate: input.defaultEndDate ? new Date(input.defaultEndDate) : null,
          createdById: context.user.id,
        },
      });
      return { template };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updateForgeTemplate = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PATCH", summary: "Update contract template", tags: ["Forge"] })
  .input(z.object({
    id: z.string(),
    name: z.string().optional(),
    content: z.string().optional(),
    defaultStartDate: z.string().nullable().optional(),
    defaultEndDate: z.string().nullable().optional(),
  }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.forgeContractTemplate.update({
        where: { id: input.id, organizationId: context.org.id },
        data: {
          name: input.name,
          content: input.content,
          defaultStartDate: input.defaultStartDate !== undefined
            ? (input.defaultStartDate ? new Date(input.defaultStartDate) : null)
            : undefined,
          defaultEndDate: input.defaultEndDate !== undefined
            ? (input.defaultEndDate ? new Date(input.defaultEndDate) : null)
            : undefined,
        },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deleteForgeTemplate = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "DELETE", summary: "Delete contract template", tags: ["Forge"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.forgeContractTemplate.delete({
        where: { id: input.id, organizationId: context.org.id },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
