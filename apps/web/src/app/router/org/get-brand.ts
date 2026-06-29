import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const getOrgBrand = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: context.org.id },
      select: {
        id: true,
        brandSlogan: true,
        brandWebsite: true,
        brandIcp: true,
        brandPositioning: true,
        brandVoiceTone: true,
        brandVisual: true,
        brandAiInstructions: true,
        brandSwot: true,
      },
    });
    return { brand: org };
  });
