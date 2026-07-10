import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
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

export const issueFiscalInvoice = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Issue NFS-e from contract",
    tags: ["Fiscal"],
  })
  .input(issueOverridesInputSchema.extend({ contractId: z.string() }))
  .output(
    z.object({ invoiceId: z.string(), status: z.string(), ref: z.string() }),
  )
  .handler(async ({ input, context, errors }) => {
    let contract;
    try {
      contract = await prisma.forgeContract.findUnique({
        where: { id: input.contractId, organizationId: context.org.id },
      });
    } catch (err) {
      console.error("[fiscal/invoices/issue] erro ao buscar contrato:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!contract)
      throw errors.NOT_FOUND({ message: "Contrato não encontrado" });

    try {
      const result = await issueInvoiceFromSource({
        organizationId: context.org.id,
        issuedById: context.user.id,
        source: {
          amount: Number(contract.value),
          defaultDescription: `Serviços conforme contrato #${contract.number}`,
        },
        link: { contractId: contract.id },
        refPrefix: "forge",
        refEntityId: contract.id,
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
      console.error("[fiscal/invoices/issue] erro ao emitir nota:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
