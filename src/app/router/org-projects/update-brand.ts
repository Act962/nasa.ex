import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const SwotSchema = z.object({
  strengths:     z.string().optional(),
  weaknesses:    z.string().optional(),
  opportunities: z.string().optional(),
  threats:       z.string().optional(),
});

export const updateProjectBrand = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    projectId:      z.string(),
    slogan:         z.string().nullable().optional(),
    website:        z.string().nullable().optional(),
    icp:            z.string().nullable().optional(),
    positioning:    z.string().nullable().optional(),
    voiceTone:      z.string().nullable().optional(),
    visual:         z.record(z.string(), z.any()).optional(),
    aiInstructions: z.string().nullable().optional(),
    swot:           SwotSchema.optional(),
  }))
  .handler(async ({ input, context }) => {
    const existing = await prisma.orgProject.findFirst({
      where: { id: input.projectId, organizationId: context.org.id },
    });
    if (!existing) throw new Error("Projeto não encontrado.");

    const { projectId, ...data } = input;
    const project = await prisma.orgProject.update({
      where: { id: projectId },
      data: {
        ...(data.slogan !== undefined         && { slogan: data.slogan }),
        ...(data.website !== undefined        && { website: data.website }),
        ...(data.icp !== undefined            && { icp: data.icp }),
        ...(data.positioning !== undefined    && { positioning: data.positioning }),
        ...(data.voiceTone !== undefined      && { voiceTone: data.voiceTone }),
        ...(data.visual !== undefined         && { visual: data.visual }),
        ...(data.aiInstructions !== undefined && { aiInstructions: data.aiInstructions }),
        ...(data.swot !== undefined           && { swot: data.swot }),
      },
    });
    return { project };
  });
