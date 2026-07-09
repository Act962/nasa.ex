import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { NfeError } from "nfe-io";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import { resolveGatewayForInvoice } from "@/features/fiscal/lib/gateways";

export const refreshFiscalInvoiceStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Refresh fiscal invoice status from gateway",
    tags: ["Fiscal"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ status: z.string() }))
  .handler(async ({ input, context, errors }) => {
    let invoice;
    try {
      invoice = await prisma.fiscalInvoice.findUnique({
        where: { id: input.id, organizationId: context.org.id },
        include: { profile: true },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/refresh-status] erro ao buscar nota fiscal:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!invoice)
      throw errors.NOT_FOUND({ message: "Nota fiscal não encontrada" });
    if (invoice.status !== "PROCESSANDO") return { status: invoice.status };

    const gateway = resolveGatewayForInvoice(invoice);

    let snapshot;
    try {
      snapshot = await gateway.getInvoice({
        invoice,
        profile: invoice.profile,
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/refresh-status] erro ao consultar gateway:",
        err,
      );
      if (err instanceof FocusNfeHttpError) {
        throw errors.BAD_REQUEST({ message: `Focus NFe: ${err.message}` });
      }
      if (err instanceof NfeError) {
        throw errors.BAD_REQUEST({ message: `NFE.io: ${err.message}` });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }

    const isAuthorized = snapshot.status === "AUTORIZADO";

    try {
      await prisma.fiscalInvoice.update({
        where: { id: invoice.id },
        data: {
          status: snapshot.status,
          flowStatus: snapshot.rawStatus,
          ...(snapshot.externalId ? { externalId: snapshot.externalId } : {}),
          focusResponse: snapshot.providerResponse as never,
          ...(isAuthorized && {
            numero: snapshot.numero,
            codigoVerificacao: snapshot.codigoVerificacao,
            urlEspelho: snapshot.urlEspelho,
            urlDanfse: snapshot.urlDanfse,
            caminhoXmlFocus: snapshot.caminhoXml,
            authorizedAt: new Date(),
          }),
          errorMessage: snapshot.errorMessage,
        },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/refresh-status] erro ao atualizar nota no banco:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }

    return { status: snapshot.status };
  });
