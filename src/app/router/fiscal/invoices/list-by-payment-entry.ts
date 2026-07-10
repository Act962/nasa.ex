import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listFiscalInvoicesByPaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({
    method: "GET",
    summary: "List fiscal invoices by payment entry",
    tags: ["Fiscal"],
  })
  .input(z.object({ paymentEntryId: z.string() }))
  .output(z.object({ invoices: z.array(z.any()) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const invoices = await prisma.fiscalInvoice.findMany({
        where: {
          paymentEntryId: input.paymentEntryId,
          organizationId: context.org.id,
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        invoices: invoices.map((invoice) => ({
          ...invoice,
          valorServicos: invoice.valorServicos.toString(),
          aliquotaIss: invoice.aliquotaIss.toString(),
        })),
      };
    } catch (err) {
      console.error(
        "[fiscal/invoices/list-by-payment-entry] erro ao listar notas:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
