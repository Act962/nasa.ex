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
            }
          : null,
      };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
