import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { hasOrgRole, ORG_PROFILE_EDITOR_ROLES } from "@/features/permissions/server/is-org-admin";
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
    if (!(await hasOrgRole(context.org.id, context.user.id, ORG_PROFILE_EDITOR_ROLES))) {
      throw errors.FORBIDDEN({ message: "Só Master, Adm ou Moderador podem editar os dados da empresa." });
    }

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
