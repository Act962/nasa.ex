import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { getAddressByCep } from "@/http/viacep/get-address";
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
  // Endereço de cobrança: o boleto exige (spec 0133, D-7).
  addressZipCode: z.string().nullable(),
  addressStreet: z.string().nullable(),
  addressNumber: z.string().nullable(),
  addressComplement: z.string().nullable(),
  addressNeighborhood: z.string().nullable(),
  addressCity: z.string().nullable(),
  addressState: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listPaymentContacts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("contacts", "view"))
  .route({ method: "GET", summary: "List payment contacts", tags: ["Payment"] })
  .input(z.object({
    search: z.string().optional(),
    contactType: z.string().optional(),
    page: z.number().default(1),
    // Default alto de propósito: os seletores de contato do formulário de
    // lançamento consomem esta mesma procedure e esperam a lista inteira.
    // A aba Contatos passa `perPage` explícito e pagina.
    perPage: z.number().default(500),
  }))
  .output(z.object({ contacts: z.array(contactShape), total: z.number() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const where = {
        organizationId: context.org.id,
        isActive: true,
        ...(input.contactType ? { contactType: input.contactType } : {}),
        ...(input.search
          ? { OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { document: { contains: input.search, mode: "insensitive" as const } },
              { email: { contains: input.search, mode: "insensitive" as const } },
              { phone: { contains: input.search, mode: "insensitive" as const } },
            ]}
          : {}),
      };

      const [contacts, total] = await Promise.all([
        prisma.paymentContact.findMany({
          where,
          orderBy: { name: "asc" },
          skip: (input.page - 1) * input.perPage,
          take: input.perPage,
        }),
        prisma.paymentContact.count({ where }),
      ]);
      return { contacts, total };
    } catch (err) {
      console.error("[payment/contacts/listPaymentContacts]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createPaymentContact = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("contacts", "create"))
  .route({ method: "POST", summary: "Create payment contact", tags: ["Payment"] })
  .input(z.object({
    name: z.string(),
    document: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    contactType: z.string().default("BOTH"),
    notes: z.string().optional(),
    creditLimit: z.number().default(0),
    addressZipCode: z.string().max(9).nullable().optional(),
    addressStreet: z.string().max(100).nullable().optional(),
    addressNumber: z.string().max(10).nullable().optional(),
    addressComplement: z.string().max(30).nullable().optional(),
    addressNeighborhood: z.string().max(60).nullable().optional(),
    addressCity: z.string().max(60).nullable().optional(),
    addressState: z.string().max(2).nullable().optional(),
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
  .use(requirePaymentAccess("contacts", "edit"))
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
    addressZipCode: z.string().max(9).nullable().optional(),
    addressStreet: z.string().max(100).nullable().optional(),
    addressNumber: z.string().max(10).nullable().optional(),
    addressComplement: z.string().max(30).nullable().optional(),
    addressNeighborhood: z.string().max(60).nullable().optional(),
    addressCity: z.string().max(60).nullable().optional(),
    addressState: z.string().max(2).nullable().optional(),
  }))
  .output(z.object({ contact: contactShape }))
  .handler(async ({ input, context, errors }) => {
    const exists = await prisma.paymentContact.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!exists) throw errors.NOT_FOUND({ message: "Contato não encontrado" });

    try {
      const { id, ...data } = input;
      const contact = await prisma.paymentContact.update({ where: { id }, data });
      return { contact };
    } catch (err) {
      console.error("[payment/contacts/update]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deletePaymentContact = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("contacts", "delete"))
  .route({ method: "DELETE", summary: "Delete payment contact", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const exists = await prisma.paymentContact.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!exists) throw errors.NOT_FOUND({ message: "Contato não encontrado" });

    try {
      await prisma.paymentContact.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch (err) {
      console.error("[payment/contacts/delete]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

/** Endereço pelo CEP, para preencher o contato (spec 0133). Sem resposta do ViaCEP, `null`. */
export const lookupPaymentContactCep = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("contacts", "view"))
  .route({ method: "POST", summary: "Look up an address by CEP", tags: ["Payment"] })
  .input(z.object({ cep: z.string().max(9) }))
  .output(
    z.object({
      address: z
        .object({ street: z.string(), neighborhood: z.string(), city: z.string(), state: z.string() })
        .nullable(),
    }),
  )
  .handler(async ({ input }) => {
    try {
      const found = await getAddressByCep(input.cep.replace(/\D/g, ""));
      return { address: { street: found.logradouro, neighborhood: found.bairro, city: found.localidade, state: found.uf } };
    } catch {
      return { address: null };
    }
  });
