import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { getPixSettings, savePixSettings, sendRecordPix, setRecordPaid } from "@/features/form-records/server/record-pix";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { isOrgOwnerOrAdmin } from "@/features/permissions/server/is-org-admin";

// PIX das fichas (spec 0081, parte D): chave da empresa, envio do copia e cola e baixa manual.

const pixSettingsSchema = z.object({
  pixKey: z.string().trim().min(3, "Informe a chave PIX").max(120),
  receiverName: z.string().trim().min(2, "Informe o nome do recebedor").max(60),
  receiverCity: z.string().trim().min(2, "Informe a cidade").max(40),
});

export const getRecordPixSettings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get the organization PIX key used by records", tags: ["Forms"] })
  .output(z.object({ pixKey: z.string(), receiverName: z.string(), receiverCity: z.string() }))
  .handler(async ({ context }) => getPixSettings(context.org.id));

export const saveRecordPixSettings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Save the organization PIX key used by records", tags: ["Forms"] })
  .input(pixSettingsSchema)
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    // A chave é a mesma das Propostas: trocá-la desvia o que os clientes pagam. Só dono e administrador.
    if (!(await isOrgOwnerOrAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({ message: "Só o dono ou um administrador da empresa altera a chave PIX." });
    }
    await savePixSettings(context.org.id, input);
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: context.user.image,
      appSlug: "forms",
      subAppSlug: "form-records",
      featureKey: "form-records.pix.settings.updated",
      action: "form-records.pix.settings.updated",
      actionLabel: "Alterou a chave PIX da empresa",
      metadata: { pixKeyLast4: input.pixKey.slice(-4) },
    }).catch((logError: unknown) => console.warn("[form-records/pix] registro da troca da chave falhou", logError));
    return { success: true };
  });

/** Situação de cobrança de uma ficha, pela resposta que a tela já tem aberta. */
export const getRecordPixStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get the PIX status of a record", tags: ["Forms"] })
  .input(z.object({ responseId: z.string() }))
  .output(
    z.object({
      recordId: z.string().nullable(),
      usageTotalCents: z.number(),
      isFinalized: z.boolean(),
      hasClient: z.boolean(),
      pixSentAt: z.string().nullable(),
      paidAt: z.string().nullable(),
      hasPixKey: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    const [record, pixSettings] = await Promise.all([
      prisma.formRecord.findFirst({
        where: { responseId: input.responseId, organizationId: context.org.id },
        select: { id: true, usageTotalCents: true, finalizedAt: true, leadId: true, pixSentAt: true, paidAt: true },
      }),
      getPixSettings(context.org.id),
    ]);
    return {
      recordId: record?.id ?? null,
      usageTotalCents: record?.usageTotalCents ?? 0,
      isFinalized: Boolean(record?.finalizedAt),
      hasClient: Boolean(record?.leadId),
      pixSentAt: record?.pixSentAt?.toISOString() ?? null,
      paidAt: record?.paidAt?.toISOString() ?? null,
      hasPixKey: Boolean(pixSettings.pixKey && pixSettings.receiverName && pixSettings.receiverCity),
    };
  });

export const sendRecordPixToClient = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Send the PIX copy-and-paste code of a record to its client", tags: ["Forms"] })
  .input(z.object({ recordId: z.string() }))
  .output(z.object({ leadName: z.string(), amountCents: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const result = await sendRecordPix({ organizationId: context.org.id, recordId: input.recordId, senderName: context.user.name });
    if (!result.isSent) throw errors.BAD_REQUEST({ message: result.message });
    return { leadName: result.leadName, amountCents: result.amountCents };
  });

export const markRecordPaid = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Mark a record as paid or undo it", tags: ["Forms"] })
  .input(z.object({ recordId: z.string(), isPaid: z.boolean() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const wasUpdated = await setRecordPaid({ organizationId: context.org.id, recordId: input.recordId, isPaid: input.isPaid });
    if (!wasUpdated) throw errors.NOT_FOUND({ message: "Ficha não encontrada ou ainda em rascunho." });
    return { success: true };
  });
