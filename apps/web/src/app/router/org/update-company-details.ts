import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const SwotSchema = z.object({
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  opportunities: z.string().optional(),
  threats: z.string().optional(),
});

export const updateCompanyDetails = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      companyNiche: z.string().min(1, "Nicho é obrigatório"),
      companyCep: z.string().min(1, "CEP é obrigatório"),
      brandIcp: z.string().optional(),
      brandSwot: SwotSchema.optional(),
    }),
  )

  .handler(async ({ input, context, errors }) => {
    try {
      const org = await prisma.organization.update({
        where: { id: context.org.id },
        data: {
          companyNiche: input.companyNiche,
          companyCep: input.companyCep,
          ...(input.brandIcp !== undefined && { brandIcp: input.brandIcp }),
          ...(input.brandSwot !== undefined && { brandSwot: input.brandSwot }),
        },
        select: {
          id: true,
          companyNiche: true,
          companyCep: true,
          brandIcp: true,
          brandSwot: true,
        },
      });

      return { org };
    } catch (err) {
      console.log(err);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
