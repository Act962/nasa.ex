import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { z } from "zod";
import type { FiscalEnvironment } from "@/generated/prisma/enums";
import {
  issueOverridesInputSchema,
  toFiscalIssueOverrides,
} from "@/features/fiscal/schemas/issue-invoice-overrides-input";
import {
  FiscalIssueNotFoundError,
  FiscalIssueValidationError,
  issueInvoiceFromSource,
} from "@/features/fiscal/server/issue-invoice";

export const issueFiscalInvoiceFromPaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({
    method: "POST",
    summary: "Issue NFS-e from payment entry",
    tags: ["Fiscal"],
  })
  .input(issueOverridesInputSchema.extend({ paymentEntryId: z.string() }))
  .output(
    z.object({ invoiceId: z.string(), status: z.string(), ref: z.string() }),
  )
  .handler(async ({ input, context, errors }) => {
    let entry;
    try {
      entry = await prisma.paymentEntry.findFirst({
        where: { id: input.paymentEntryId, organizationId: context.org.id },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue-from-payment-entry] erro ao buscar lançamento:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!entry)
      throw errors.NOT_FOUND({ message: "Lançamento não encontrado" });
    if (entry.type !== "RECEIVABLE")
      throw errors.BAD_REQUEST({
        message: "Só é possível emitir NFS-e para lançamentos a receber",
      });
    if (entry.status === "CANCELLED")
      throw errors.BAD_REQUEST({
        message: "Lançamento cancelado não pode emitir NFS-e",
      });

    try {
      const result = await issueInvoiceFromSource({
        organizationId: context.org.id,
        issuedById: context.user.id,
        source: {
          amount: entry.amount / 100,
          defaultDescription:
            entry.description ||
            `Referente ao lançamento ${entry.documentNumber ?? entry.id}`,
        },
        link: { paymentEntryId: entry.id },
        refPrefix: "payment",
        refEntityId: entry.id,
        tipoTomador: input.tipoTomador,
        overrides: toFiscalIssueOverrides(input),
        environment: input.environment as FiscalEnvironment,
      });
      return result;
    } catch (err) {
      if (err instanceof FiscalIssueValidationError) {
        throw errors.BAD_REQUEST({ message: err.message });
      }
      if (err instanceof FiscalIssueNotFoundError) {
        throw errors.NOT_FOUND({ message: err.message });
      }
      console.error(
        "[fiscal/invoices/issue-from-payment-entry] erro ao emitir nota:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
