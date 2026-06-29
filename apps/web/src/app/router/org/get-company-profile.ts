import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const getCompanyProfile = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const org = await prisma.organization.findUnique({
      where: { id: context.org.id },
      select: {
        id: true,
        name: true,
        companyType: true,
        companySegment: true,
        cnpj: true,
        contactEmail: true,
        contactPhone: true,
        addressLine: true,
        city: true,
        state: true,
        postalCode: true,
      },
    });
    return { org };
  });
