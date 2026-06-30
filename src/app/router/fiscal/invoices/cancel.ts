import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { cancelarNfse } from "@/http/focus-nfe/cancelar-nfse";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { resolveCompanyToken } from "./utils";

export const cancelFiscalInvoice = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Cancel fiscal invoice", tags: ["Fiscal"] })
  .input(z.object({ id: z.string(), justificativa: z.string().min(15) }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    let invoice;
    try {
      invoice = await prisma.fiscalInvoice.findUnique({
        where: { id: input.id, organizationId: context.org.id },
      });
    } catch (err) {
      console.error("[fiscal/invoices/cancel] erro ao buscar nota fiscal:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!invoice)
      throw errors.NOT_FOUND({ message: "Nota fiscal não encontrada" });
    if (invoice.status !== "AUTORIZADO") {
      throw errors.BAD_REQUEST({
        message: "Apenas notas autorizadas podem ser canceladas",
      });
    }

    const cancelEnvironment = invoice.environment as FiscalEnvironment;

    let cancelProfile;
    try {
      cancelProfile = await prisma.fiscalCompanyProfile.findUnique({
        where: { organizationId: context.org.id },
        select: { focusTokenHomologacao: true, focusTokenProducao: true },
      });
    } catch (err) {
      console.error("[fiscal/invoices/cancel] erro ao buscar perfil fiscal:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!cancelProfile) throw errors.INTERNAL_SERVER_ERROR;

    let cancelToken;
    try {
      cancelToken = resolveCompanyToken(cancelProfile, cancelEnvironment);
    } catch (err) {
      console.error("[fiscal/invoices/cancel] erro ao resolver token Focus NFe:", err);
      throw errors.BAD_REQUEST({
        message: err instanceof Error ? err.message : "Token Focus NFe não configurado",
      });
    }

    try {
      await cancelarNfse(invoice.ref, input.justificativa, cancelEnvironment, cancelToken);
    } catch (err) {
      console.error("[fiscal/invoices/cancel] erro ao cancelar na Focus NFe:", err);
      if (err instanceof FocusNfeHttpError) {
        throw errors.BAD_REQUEST({ message: `Focus NFe: ${err.message}` });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }

    try {
      await prisma.fiscalInvoice.update({
        where: { id: invoice.id },
        data: { status: "CANCELADO" },
      });
    } catch (err) {
      console.error("[fiscal/invoices/cancel] erro ao atualizar status no banco:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }

    return { ok: true };
  });
