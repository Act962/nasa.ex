import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { isOrgAdmin } from "../_access";

// Spec 0106: situação da importação da carteira do ERP (card na integração NERP).
export const getErpCarteiraStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const [record, canImport] = await Promise.all([
      prisma.erpCarteiraImport.findUnique({
        where: { organizationId: context.org.id },
        select: {
          trackingId: true,
          statusId: true,
          status: true,
          mode: true,
          report: true,
          error: true,
          startedAt: true,
          finishedAt: true,
          lastFullAt: true,
          lastRefreshAt: true,
        },
      }),
      isOrgAdmin(context.org.id, context.user.id),
    ]);
    return { canImport, record };
  });
