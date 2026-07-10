import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getFiscalInvoice = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get fiscal invoice", tags: ["Fiscal"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ invoice: z.any() }))
  .handler(async ({ input, context, errors }) => {
    let invoice;
    try {
      invoice = await prisma.fiscalInvoice.findUnique({
        where: { id: input.id, organizationId: context.org.id },
      });
    } catch (err) {
      console.error("[fiscal/invoices/get] erro ao buscar nota fiscal:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }

    if (!invoice)
      throw errors.NOT_FOUND({ message: "Nota fiscal não encontrada" });

    return {
      invoice: {
        ...invoice,
        valorServicos: invoice.valorServicos.toString(),
        aliquotaIss: invoice.aliquotaIss.toString(),
      },
    };
  });
