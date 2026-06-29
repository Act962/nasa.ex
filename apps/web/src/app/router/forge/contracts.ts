import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";

const clientDataShape = z
  .object({
    name: z.string().optional().nullable(),
    document: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    contactName: z.string().optional().nullable(),
  })
  .nullable()
  .optional();

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
  clientData: z.any().nullable(),
  isTemplate: z.boolean(),
  templateMarkedByModerator: z.boolean(),
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
        name: z.string().min(1, "Nome do assinante obrigatório"),
        email: z.string().email("E-mail do assinante inválido"),
        whatsapp: z.string().optional(),
      })).min(1, "Adicione ao menos 1 assinante"),
      clientData: clientDataShape,
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
            clientData: input.clientData ?? undefined,
            createdById: context.user.id,
          },
          select: { id: true, number: true },
        });
      });

      await chargeStarsByAction(context.org.id, "forge_contract_create", {
        userId: context.user.id,
        description: `Gerou contrato #${contract.number}`,
        appSlug: "forge",
      });

      return { contract };
    } catch (err) {
      console.error("[forge/contracts create]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

type StoredSigner = {
  name: string;
  email: string;
  whatsapp?: string;
  token: string;
  signed_at: string | null;
  sign_method?: string;
};

type IncomingSigner = {
  name: string;
  email: string;
  whatsapp?: string;
  token?: string;
  signed_at?: string | null;
  sign_method?: string;
};

function normalizeSigners(
  incoming: IncomingSigner[],
  existing: StoredSigner[],
): StoredSigner[] {
  const byToken = new Map(existing.map((s) => [s.token, s]));
  return incoming.map((s) => {
    const prev = s.token ? byToken.get(s.token) : undefined;
    if (prev) {
      // preserva o estado de assinatura: nunca permite sobrescrever signed_at ou sign_method
      return {
        name: s.name,
        email: s.email,
        whatsapp: s.whatsapp,
        token: prev.token,
        signed_at: prev.signed_at,
        sign_method: prev.sign_method,
      };
    }
    return {
      name: s.name,
      email: s.email,
      whatsapp: s.whatsapp,
      token: s.token ?? crypto.randomUUID(),
      signed_at: null,
    };
  });
}

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
      signers: z
        .array(
          z.object({
            name: z.string().min(1, "Nome do assinante obrigatório"),
            email: z.string().email("E-mail do assinante inválido"),
            whatsapp: z.string().optional(),
            token: z.string().optional(),
            signed_at: z.string().nullable().optional(),
            sign_method: z.string().optional(),
          }),
        )
        .optional(),
      clientData: clientDataShape,
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const existing = await prisma.forgeContract.findUnique({
        where: { id: input.id, organizationId: context.org.id },
        select: { signers: true, status: true },
      });
      if (!existing) throw errors.NOT_FOUND({ message: "Contrato não encontrado" });

      const existingSigners = (existing.signers as StoredSigner[]) ?? [];
      const anySigned = existingSigners.some((s) => s.signed_at);
      const allSigned = anySigned && existingSigners.every((s) => s.signed_at);

      if (allSigned) {
        throw errors.FORBIDDEN({ message: "Contrato finalizado não pode ser editado" });
      }

      const blockedFieldChanged =
        input.content !== undefined ||
        input.signers !== undefined ||
        input.value !== undefined ||
        input.startDate !== undefined;

      if (anySigned && blockedFieldChanged) {
        throw errors.FORBIDDEN({
          message: "Edição limitada — algum assinante já assinou. Apenas data de término pode ser alterada.",
        });
      }

      const nextSigners = input.signers
        ? normalizeSigners(input.signers, existingSigners)
        : undefined;

      await prisma.forgeContract.update({
        where: { id: input.id, organizationId: context.org.id },
        data: {
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          value: input.value,
          status: input.status as never,
          templateId: input.templateId,
          content: input.content,
          signers: nextSigners,
          clientData: input.clientData === undefined ? undefined : (input.clientData ?? undefined),
        },
      });
      return { ok: true };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err) throw err;
      console.error("[forge/contracts update]", err);
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
