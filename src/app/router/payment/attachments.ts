import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import { deleteStoredObject } from "@/lib/s3-client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { PAYMENT_ATTACHMENT_KINDS } from "@/features/payment/lib/attachments";
import { linkAttachmentsToEntries } from "@/features/payment/server/attachments/link-attachments-to-entries";

// Anexos de lançamento financeiro (spec 0008). Permissão reaproveita o recurso
// `entries`: quem pode ver o lançamento pode ver o documento que o originou
// (D-5). O upload em si é REST (`/api/payment/attachments/upload`) porque
// multipart não passa por oRPC.

const kindSchema = z.enum(PAYMENT_ATTACHMENT_KINDS);

const attachmentShape = z.object({
  id: z.string(),
  entryId: z.string().nullable(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  kind: kindSchema,
  description: z.string().nullable(),
  createdAt: z.date(),
  uploadedBy: z
    .object({ id: z.string(), name: z.string().nullable(), image: z.string().nullable() })
    .nullable(),
  entry: z
    .object({
      id: z.string(),
      description: z.string(),
      type: z.enum(["RECEIVABLE", "PAYABLE"]),
      amount: z.number(),
      dueDate: z.date(),
    })
    .nullable(),
});

const attachmentInclude = {
  uploadedBy: { select: { id: true, name: true, image: true } },
  entry: {
    select: { id: true, description: true, type: true, amount: true, dueDate: true },
  },
} as const;

export const listPaymentAttachments = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "GET", summary: "List payment attachments", tags: ["Payment"] })
  .input(
    z.object({
      search: z.string().optional(),
      kind: kindSchema.optional(),
      // "unlinked" = anexo sem lançamento (upload abandonado ou lançamento
      // excluído). É um filtro de faxina, não um detalhe de implementação.
      linkage: z.enum(["all", "RECEIVABLE", "PAYABLE", "unlinked"]).default("all"),
      entryId: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      page: z.number().default(1),
      perPage: z.number().default(24),
    }),
  )
  .output(z.object({ attachments: z.array(attachmentShape), total: z.number() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const search = input.search?.trim();

      const where = {
        organizationId: context.org.id,
        ...(input.entryId ? { entryId: input.entryId } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.linkage === "unlinked" ? { entryId: null } : {}),
        ...(input.linkage === "RECEIVABLE" || input.linkage === "PAYABLE"
          ? { entry: { type: input.linkage } }
          : {}),
        ...(input.dateFrom || input.dateTo
          ? {
              createdAt: {
                ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
                ...(input.dateTo ? { lte: new Date(input.dateTo) } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { fileName: { contains: search, mode: "insensitive" as const } },
                { description: { contains: search, mode: "insensitive" as const } },
                {
                  entry: {
                    description: { contains: search, mode: "insensitive" as const },
                  },
                },
              ],
            }
          : {}),
      };

      const [attachments, total] = await Promise.all([
        prisma.paymentAttachment.findMany({
          where,
          include: attachmentInclude,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.perPage,
          take: input.perPage,
        }),
        prisma.paymentAttachment.count({ where }),
      ]);

      return { attachments, total };
    } catch (err) {
      console.error("[payment/attachments list]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updatePaymentAttachment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "PATCH", summary: "Update payment attachment", tags: ["Payment"] })
  .input(
    z.object({
      id: z.string(),
      fileName: z.string().min(1).optional(),
      kind: kindSchema.optional(),
      description: z.string().nullable().optional(),
      // `null` desvincula; string vincula a outro lançamento.
      entryId: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ attachment: attachmentShape }))
  .handler(async ({ input, context, errors }) => {
    const { id, entryId, ...fields } = input;

    const existing = await prisma.paymentAttachment.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!existing) throw errors.NOT_FOUND({ message: "Anexo não encontrado" });

    if (entryId) {
      const entry = await prisma.paymentEntry.findFirst({
        where: { id: entryId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!entry) throw errors.NOT_FOUND({ message: "Lançamento não encontrado" });
    }

    try {
      const attachment = await prisma.paymentAttachment.update({
        where: { id },
        data: {
          ...fields,
          ...(entryId !== undefined ? { entryId } : {}),
        },
        include: attachmentInclude,
      });
      return { attachment };
    } catch (err) {
      console.error("[payment/attachments update]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deletePaymentAttachment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "delete"))
  .route({ method: "DELETE", summary: "Delete payment attachment", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const attachment = await prisma.paymentAttachment.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, fileKey: true },
    });
    if (!attachment) throw errors.NOT_FOUND({ message: "Anexo não encontrado" });

    try {
      await prisma.paymentAttachment.delete({ where: { id: attachment.id } });
    } catch (err) {
      console.error("[payment/attachments delete]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }

    // Lançamento parcelado grava um registro por parcela apontando pra mesma
    // chave (D-4). Só apaga o objeto quando nenhum outro registro o referencia
    // — senão as parcelas irmãs ficariam com link quebrado.
    const remainingReferences = await prisma.paymentAttachment.count({
      where: { fileKey: attachment.fileKey },
    });
    if (remainingReferences === 0) {
      await deleteStoredObject(attachment.fileKey);
    }

    return { success: true };
  });

/**
 * Vincula anexos já enviados a um lançamento. Chamada pelo form no submit e
 * pelo dialog de edição (RF-2, RF-10).
 *
 * Em lançamento parcelado, `entryIds` traz todas as parcelas: o primeiro
 * registro é reaproveitado e as demais parcelas ganham cópias apontando pra
 * mesma `fileKey`, pra que o anexo seja encontrável a partir de qualquer
 * parcela (RF-5).
 */
export const linkPaymentAttachments = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Link attachments to entries", tags: ["Payment"] })
  .input(
    z.object({
      attachmentIds: z.array(z.string()).min(1),
      entryIds: z.array(z.string()).min(1),
    }),
  )
  .output(z.object({ linked: z.number() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const linked = await linkAttachmentsToEntries({
        organizationId: context.org.id,
        attachmentIds: input.attachmentIds,
        entryIds: input.entryIds,
      });

      if (linked === 0) {
        throw errors.NOT_FOUND({ message: "Anexo ou lançamento não encontrado" });
      }

      return { linked };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err) throw err;
      console.error("[payment/attachments link]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
