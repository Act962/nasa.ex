import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";
import {
  createCompanyCredential,
  deleteCompanyCredential,
  listCompanyCredentials,
  revealCompanyCredential,
  updateCompanyCredential,
} from "@/features/accounting/server/credentials/company-credentials";
import {
  hasPaymentPasskey,
  verifyWebauthnStepUp,
} from "@/features/accounting/server/credentials/verify-webauthn-step-up";
import {
  deleteCompanyCertificate,
  listCompanyCertificates,
  parsePfxCertificate,
  storeCompanyCertificate,
} from "@/features/accounting/server/credentials/company-certificates";
import { accountingAdminProcedure } from "./procedures";

// Cofre de credenciais e certificados (spec 0051, item 9). Tudo aqui é
// ADMIN/OWNER do financeiro; revelar senha exige biometria (WebAuthn).

const nullableText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

const credentialFields = z.object({
  portal: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  username: nullableText(160),
  url: nullableText(300).refine((value) => value === null || /^https?:\/\//i.test(value), "Link deve começar com https://"),
  notes: nullableText(1000),
});

export const listAccountingCredentials = accountingAdminProcedure
  .route({ method: "GET", summary: "Cofre de credenciais", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const [credentials, hasPasskey] = await Promise.all([
      listCompanyCredentials(context.org.id),
      hasPaymentPasskey(context.user.id, context.org.id),
    ]);
    return { credentials, hasPasskey };
  });

export const createAccountingCredential = accountingAdminProcedure
  .route({ method: "POST", summary: "Guarda credencial no cofre", tags: ["Accounting"] })
  .input(credentialFields.extend({ secret: z.string().min(1).max(500) }))
  .handler(async ({ input, context }) => {
    const { secret, ...data } = input;
    const created = await createCompanyCredential({ organizationId: context.org.id, userId: context.user.id, data, secret });
    return { id: created.id };
  });

export const updateAccountingCredential = accountingAdminProcedure
  .route({ method: "PUT", summary: "Atualiza credencial do cofre", tags: ["Accounting"] })
  .input(credentialFields.extend({ credentialId: z.string().min(1), secret: z.string().max(500).optional() }))
  .handler(async ({ input, context, errors }) => {
    const { credentialId, secret, ...data } = input;
    const isUpdated = await updateCompanyCredential({
      organizationId: context.org.id,
      credentialId,
      data,
      secret: secret || undefined,
    });
    if (!isUpdated) throw errors.NOT_FOUND({ message: "Credencial não encontrada." });
    return { ok: true as const };
  });

export const deleteAccountingCredential = accountingAdminProcedure
  .route({ method: "DELETE", summary: "Remove credencial do cofre", tags: ["Accounting"] })
  .input(z.object({ credentialId: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    const isDeleted = await deleteCompanyCredential(context.org.id, input.credentialId);
    if (!isDeleted) throw errors.NOT_FOUND({ message: "Credencial não encontrada." });
    return { ok: true as const };
  });

export const revealAccountingCredential = accountingAdminProcedure
  .route({ method: "POST", summary: "Revela senha do cofre (com biometria)", tags: ["Accounting"] })
  .input(z.object({ credentialId: z.string().min(1), webauthnResponse: z.unknown() }))
  .handler(async ({ input, context, errors }) => {
    const stepUp = await verifyWebauthnStepUp({
      userId: context.user.id,
      organizationId: context.org.id,
      response: input.webauthnResponse,
    });
    if (!stepUp.ok) {
      if (stepUp.reason === "no_passkey") {
        throw errors.BAD_REQUEST({
          message: `${stepUp.message} Use "Cadastrar biometria" aqui no cofre (fica salvo no seu acesso do financeiro).`,
        });
      }
      throw errors.FORBIDDEN({ message: stepUp.message });
    }

    const revealed = await revealCompanyCredential({
      organizationId: context.org.id,
      credentialId: input.credentialId,
      userId: context.user.id,
    });
    if (!revealed) throw errors.NOT_FOUND({ message: "Credencial não encontrada." });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: context.user.image ?? null,
      appSlug: "payment",
      subAppSlug: "payment-accounting",
      action: "accounting.credential.revealed",
      actionLabel: `Revelou a senha "${revealed.label}" (${revealed.portal}) do cofre`,
      resource: revealed.label,
      resourceId: input.credentialId,
    });
    return { secret: revealed.secret };
  });

const MAX_PFX_BASE64_LENGTH = 70_000;

export const uploadAccountingCertificate = accountingAdminProcedure
  .route({ method: "POST", summary: "Guarda certificado A1", tags: ["Accounting"] })
  .input(z.object({ pfxBase64: z.string().min(1).max(MAX_PFX_BASE64_LENGTH), password: z.string().min(1).max(200) }))
  .handler(async ({ input, context, errors }) => {
    const parsed = parsePfxCertificate(input.pfxBase64, input.password);
    if (!parsed.ok) throw errors.BAD_REQUEST({ message: parsed.message });

    const stored = await storeCompanyCertificate({
      organizationId: context.org.id,
      userId: context.user.id,
      pfxBase64: input.pfxBase64,
      password: input.password,
      certificate: parsed.certificate,
    });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: context.user.image ?? null,
      appSlug: "payment",
      subAppSlug: "payment-accounting",
      action: "accounting.certificate.uploaded",
      actionLabel: `Guardou o certificado digital A1 de "${parsed.certificate.subjectName ?? "empresa"}"`,
      resourceId: stored.id,
      metadata: { validTo: parsed.certificate.validTo.toISOString() },
    });
    return {
      id: stored.id,
      subjectName: parsed.certificate.subjectName,
      document: parsed.certificate.document,
      validFrom: parsed.certificate.validFrom,
      validTo: parsed.certificate.validTo,
    };
  });

export const listAccountingCertificates = accountingAdminProcedure
  .route({ method: "GET", summary: "Certificados digitais", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .handler(async ({ context }) => ({ certificates: await listCompanyCertificates(context.org.id) }));

export const deleteAccountingCertificate = accountingAdminProcedure
  .route({ method: "DELETE", summary: "Remove certificado digital", tags: ["Accounting"] })
  .input(z.object({ certificateId: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    const isDeleted = await deleteCompanyCertificate(context.org.id, input.certificateId);
    if (!isDeleted) throw errors.NOT_FOUND({ message: "Certificado não encontrado." });
    return { ok: true as const };
  });

export const accountingCredentialsRouter = {
  list: listAccountingCredentials,
  create: createAccountingCredential,
  update: updateAccountingCredential,
  delete: deleteAccountingCredential,
  reveal: revealAccountingCredential,
  uploadCertificate: uploadAccountingCertificate,
  listCertificates: listAccountingCertificates,
  deleteCertificate: deleteAccountingCertificate,
};
