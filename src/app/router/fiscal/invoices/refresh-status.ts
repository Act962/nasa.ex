import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { consultarNfse } from "@/http/focus-nfe/consultar-nfse";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { resolveCompanyToken, focusStatusToDb } from "./utils";

export const refreshFiscalInvoiceStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Refresh fiscal invoice status from Focus",
    tags: ["Fiscal"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ status: z.string() }))
  .handler(async ({ input, context, errors }) => {
    let invoice;
    try {
      invoice = await prisma.fiscalInvoice.findUnique({
        where: { id: input.id, organizationId: context.org.id },
      });
    } catch (err) {
      console.error("[fiscal/invoices/refresh-status] erro ao buscar nota fiscal:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!invoice)
      throw errors.NOT_FOUND({ message: "Nota fiscal não encontrada" });
    if (invoice.status !== "PROCESSANDO") return { status: invoice.status };

    const invoiceEnvironment = invoice.environment as FiscalEnvironment;

    let invoiceProfile;
    try {
      invoiceProfile = await prisma.fiscalCompanyProfile.findUnique({
        where: { organizationId: context.org.id },
        select: { focusTokenHomologacao: true, focusTokenProducao: true },
      });
    } catch (err) {
      console.error("[fiscal/invoices/refresh-status] erro ao buscar perfil fiscal:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!invoiceProfile) throw errors.INTERNAL_SERVER_ERROR;

    let companyToken;
    try {
      companyToken = resolveCompanyToken(invoiceProfile, invoiceEnvironment);
    } catch (err) {
      console.error("[fiscal/invoices/refresh-status] erro ao resolver token Focus NFe:", err);
      throw errors.BAD_REQUEST({
        message: err instanceof Error ? err.message : "Token Focus NFe não configurado",
      });
    }

    let focusData;
    try {
      focusData = await consultarNfse(invoice.ref, invoiceEnvironment, companyToken);
    } catch (err) {
      console.error("[fiscal/invoices/refresh-status] erro ao consultar Focus NFe:", err);
      if (err instanceof FocusNfeHttpError) {
        throw errors.BAD_REQUEST({ message: `Focus NFe: ${err.message}` });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }

    const dbStatus = focusStatusToDb(focusData.status);
    const isAuthorized = dbStatus === "AUTORIZADO";

    try {
      await prisma.fiscalInvoice.update({
        where: { id: invoice.id },
        data: {
          status: dbStatus,
          focusResponse: focusData as never,
          ...(isAuthorized && {
            numero: focusData.numero,
            codigoVerificacao: focusData.codigo_verificacao,
            urlEspelho: focusData.url,
            urlDanfse: focusData.url_danfse,
            caminhoXmlFocus: focusData.caminho_xml_nota_fiscal,
            authorizedAt: new Date(),
          }),
          errorMessage:
            dbStatus === "ERRO" ? (focusData.mensagem_erro ?? null) : null,
        },
      });
    } catch (err) {
      console.error("[fiscal/invoices/refresh-status] erro ao atualizar nota no banco:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }

    return { status: dbStatus };
  });
