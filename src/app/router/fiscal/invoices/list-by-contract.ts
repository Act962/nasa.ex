import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listFiscalInvoicesByContract = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "List fiscal invoices by contract",
    tags: ["Fiscal"],
  })
  .input(z.object({ contractId: z.string() }))
  .output(z.object({ invoices: z.array(z.any()) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const invoices = await prisma.fiscalInvoice.findMany({
        where: { contractId: input.contractId, organizationId: context.org.id },
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
      console.error("[fiscal/invoices/list-by-contract] erro ao listar notas:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
