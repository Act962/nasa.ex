import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { ensureCompanyDocumentsFolder } from "@/features/accounting/server/nbox/ensure-company-documents-folder";
import {
  listCompanyDocuments,
  listRequirementApplicability,
} from "@/features/accounting/server/documents/list-company-documents";
import { extractCompanyDocument } from "@/features/accounting/server/documents/extract-company-document";
import {
  confirmCompanyDocument,
  deleteCompanyDocument,
} from "@/features/accounting/server/documents/manage-company-document";
import { parseDateOnly } from "@/features/accounting/server/documents/document-lifecycle";
import { isFinanceAdminRole } from "@/features/accounting/server/documents/authorize-accounting-request";
import { ROLE_DEFAULTS, resolveEffectivePermissions } from "@/features/payment/lib/permissions";
import {
  accountingAdminProcedure,
  accountingReadProcedure,
  accountingWriteProcedure,
  monthKeySchemaPattern,
} from "./procedures";

// Documentos da empresa + N-Box restrito (spec 0051, item 9). O upload e a
// leitura do arquivo são rotas REST em /api/accounting/documents.

function readRole(context: unknown): string | null {
  const role = (context as { paymentAccess?: { role?: unknown } }).paymentAccess?.role;
  return typeof role === "string" ? role : null;
}

type PaymentRoleName = keyof typeof ROLE_DEFAULTS;

function canEditDocuments(context: unknown): boolean {
  const access = (context as { paymentAccess?: { role?: string; permissions?: unknown } }).paymentAccess;
  if (!access?.role || !(access.role in ROLE_DEFAULTS)) return false;
  return resolveEffectivePermissions(access.role as PaymentRoleName, access.permissions).entries?.edit === true;
}

export const listAccountingDocuments = accountingReadProcedure
  .route({ method: "GET", summary: "Documentos da empresa", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const [documents, requirementOverrides] = await Promise.all([
      listCompanyDocuments(context.org.id),
      listRequirementApplicability(context.org.id),
    ]);
    return {
      documents,
      requirementOverrides,
      canManage: isFinanceAdminRole(readRole(context)),
      canEdit: canEditDocuments(context),
    };
  });

/** Pasta restrita do N-Box. Quem não é ADMIN/OWNER não navega nela. */
export const getAccountingDocumentsFolder = accountingReadProcedure
  .route({ method: "GET", summary: "Pasta de documentos no N-Box", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    if (!isFinanceAdminRole(readRole(context))) return { rootFolderId: null, canBrowse: false };
    const folders = await ensureCompanyDocumentsFolder(context.org.id, context.user.id);
    return { rootFolderId: folders.rootFolderId, canBrowse: true };
  });

export const extractAccountingDocument = accountingWriteProcedure
  .route({ method: "POST", summary: "Lê o documento com IA", tags: ["Accounting"] })
  .input(z.object({ documentId: z.string().min(1), force: z.boolean().optional() }))
  .handler(async ({ input, context, errors }) => {
    const result = await extractCompanyDocument({
      organizationId: context.org.id,
      documentId: input.documentId,
      userId: context.user.id,
      force: input.force,
    });
    if (!result.ok) {
      if (result.reason === "not_found") throw errors.NOT_FOUND({ message: result.message });
      throw errors.BAD_REQUEST({ message: result.message });
    }
    return { extraction: result.extraction, fromCache: result.fromCache };
  });

const optionalDate = z.string().max(30).nullable().optional();

export const confirmAccountingDocument = accountingWriteProcedure
  .route({ method: "POST", summary: "Confirma os dados do documento", tags: ["Accounting"] })
  .input(
    z.object({
      documentId: z.string().min(1),
      typeCode: z.string().min(1).max(60),
      label: z.string().trim().max(120).nullable().optional(),
      number: z.string().trim().max(120).nullable().optional(),
      issuedAt: optionalDate,
      expiresAt: optionalDate,
      period: z.string().regex(monthKeySchemaPattern).nullable().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const result = await confirmCompanyDocument({
      organizationId: context.org.id,
      userId: context.user.id,
      documentId: input.documentId,
      typeCode: input.typeCode,
      label: input.label || null,
      number: input.number || null,
      issuedAt: parseDateOnly(input.issuedAt),
      expiresAt: parseDateOnly(input.expiresAt),
      period: input.period ?? null,
    });
    if (!result.ok) {
      if (result.reason === "not_found") throw errors.NOT_FOUND({ message: result.message });
      throw errors.BAD_REQUEST({ message: result.message });
    }
    return { ok: true as const };
  });

export const deleteAccountingDocument = accountingAdminProcedure
  .route({ method: "DELETE", summary: "Exclui documento da empresa", tags: ["Accounting"] })
  .input(z.object({ documentId: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    const result = await deleteCompanyDocument({ organizationId: context.org.id, documentId: input.documentId });
    if (!result.ok) throw errors.NOT_FOUND({ message: result.message });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: context.user.image ?? null,
      appSlug: "payment",
      subAppSlug: "payment-accounting",
      action: "accounting.document.deleted",
      actionLabel: `Excluiu o documento "${result.fileName ?? result.typeCode ?? input.documentId}"`,
      resource: result.fileName ?? undefined,
      resourceId: input.documentId,
      metadata: { typeCode: result.typeCode },
    });
    return { ok: true as const };
  });

export const accountingDocumentsRouter = {
  list: listAccountingDocuments,
  folder: getAccountingDocumentsFolder,
  extract: extractAccountingDocument,
  confirm: confirmAccountingDocument,
  delete: deleteAccountingDocument,
};
