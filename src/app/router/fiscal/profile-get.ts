import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const fiscalProfileGet = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get fiscal profile", tags: ["Fiscal"] })
  .input(z.object({}))
  .handler(async ({ context, errors }) => {
    try {
      const profile = await prisma.fiscalCompanyProfile.findUnique({
        where: { organizationId: context.org.id },
      });
      return {
        profile: profile
          ? {
              ...profile,
              defaultAliquotaIss: profile.defaultAliquotaIss.toString(),
              // Prisma Decimal não serializa direto pelo oRPC — expõe como string.
              defaultIrPercent: profile.defaultIrPercent.toString(),
              defaultPisPercent: profile.defaultPisPercent.toString(),
              defaultCofinsPercent: profile.defaultCofinsPercent.toString(),
              defaultCsllPercent: profile.defaultCsllPercent.toString(),
              defaultInssPercent: profile.defaultInssPercent.toString(),
              defaultOutrasRetencoesPercent:
                profile.defaultOutrasRetencoesPercent.toString(),
              defaultDeducoesPercent: profile.defaultDeducoesPercent.toString(),
              defaultDescontoIncondicionadoPercent:
                profile.defaultDescontoIncondicionadoPercent.toString(),
              defaultDescontoCondicionadoPercent:
                profile.defaultDescontoCondicionadoPercent.toString(),
            }
          : null,
      };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
