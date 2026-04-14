import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const SwotSchema = z.object({
  strengths:    z.string().optional(),
  weaknesses:   z.string().optional(),
  opportunities: z.string().optional(),
  threats:      z.string().optional(),
});

export const updateOrgBrand = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    brandSlogan:         z.string().nullable().optional(),
    brandWebsite:        z.string().nullable().optional(),
    brandIcp:            z.string().nullable().optional(),
    brandPositioning:    z.string().nullable().optional(),
    brandVoiceTone:      z.string().nullable().optional(),
    brandVisual:         z.record(z.string(), z.any()).optional(),
    brandAiInstructions: z.string().nullable().optional(),
    brandSwot:           SwotSchema.optional(),
  }))
  .handler(async ({ input, context }) => {
    const org = await prisma.organization.update({
      where: { id: context.org.id },
      data: {
        ...(input.brandSlogan !== undefined         && { brandSlogan: input.brandSlogan }),
        ...(input.brandWebsite !== undefined        && { brandWebsite: input.brandWebsite }),
        ...(input.brandIcp !== undefined            && { brandIcp: input.brandIcp }),
        ...(input.brandPositioning !== undefined    && { brandPositioning: input.brandPositioning }),
        ...(input.brandVoiceTone !== undefined      && { brandVoiceTone: input.brandVoiceTone }),
        ...(input.brandVisual !== undefined         && { brandVisual: input.brandVisual }),
        ...(input.brandAiInstructions !== undefined && { brandAiInstructions: input.brandAiInstructions }),
        ...(input.brandSwot !== undefined           && { brandSwot: input.brandSwot }),
      },
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
    return { org };
  });
