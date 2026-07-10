import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { NfeError } from "nfe-io";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import { resolveGatewayForInvoice } from "@/features/fiscal/lib/gateways";

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
        include: { profile: true },
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

    const gateway = resolveGatewayForInvoice(invoice);

    try {
      await gateway.cancelInvoice(
        { invoice, profile: invoice.profile },
        input.justificativa,
      );
    } catch (err) {
      console.error(
        "[fiscal/invoices/cancel] erro ao cancelar no gateway:",
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

    // NFE.io cancela de forma assíncrona (WaitingSendCancel → Cancelled); o
    // webhook/refresh confirma. Marcamos CANCELADO otimista como no fluxo Focus.
    try {
      await prisma.fiscalInvoice.update({
        where: { id: invoice.id },
        data: { status: "CANCELADO" },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/cancel] erro ao atualizar status no banco:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }

    return { ok: true };
  });
