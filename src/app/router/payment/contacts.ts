import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const contactShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  document: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  contactType: z.string(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  creditLimit: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listPaymentContacts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List payment contacts", tags: ["Payment"] })
  .input(z.object({
    search: z.string().optional(),
    contactType: z.string().optional(),
  }))
  .output(z.object({ contacts: z.array(contactShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const contacts = await prisma.paymentContact.findMany({
        where: {
          organizationId: context.org.id,
          isActive: true,
          ...(input.contactType ? { contactType: input.contactType } : {}),
          ...(input.search
            ? { OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { document: { contains: input.search, mode: "insensitive" } },
                { email: { contains: input.search, mode: "insensitive" } },
              ]}
            : {}),
        },
        orderBy: { name: "asc" },
      });
      return { contacts };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createPaymentContact = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Create payment contact", tags: ["Payment"] })
  .input(z.object({
    name: z.string(),
    document: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    contactType: z.string().default("BOTH"),
    notes: z.string().optional(),
    creditLimit: z.number().default(0),
  }))
  .output(z.object({ contact: contactShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const contact = await prisma.paymentContact.create({
        data: { ...input, organizationId: context.org.id },
      });
      return { contact };
    } catch (err) {
      console.error("[payment/contacts/create]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updatePaymentContact = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PATCH", summary: "Update payment contact", tags: ["Payment"] })
  .input(z.object({
    id: z.string(),
    name: z.string().optional(),
    document: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    contactType: z.string().optional(),
    notes: z.string().nullable().optional(),
    creditLimit: z.number().optional(),
  }))
  .output(z.object({ contact: contactShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const { id, ...data } = input;
      const contact = await prisma.paymentContact.update({
        where: { id, organizationId: context.org.id },
        data,
      });
      return { contact };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deletePaymentContact = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "DELETE", summary: "Delete payment contact", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.paymentContact.update({
        where: { id: input.id, organizationId: context.org.id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
