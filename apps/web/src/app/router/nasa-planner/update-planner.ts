import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updatePlanner = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      plannerId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      brandName: z.string().optional(),
      brandSlogan: z.string().optional(),
      website: z.string().optional(),
      icp: z.string().optional(),
      swot: z.record(z.string(), z.any()).optional(),
      positioning: z.string().optional(),
      toneOfVoice: z.string().optional(),
      keyMessages: z.array(z.string()).optional(),
      forbiddenWords: z.array(z.string()).optional(),
      primaryColors: z.array(z.string()).optional(),
      secondaryColors: z.array(z.string()).optional(),
      fonts: z.record(z.string(), z.any()).optional(),
      logoLight: z.string().optional(),
      logoDark: z.string().optional(),
      logoSquare: z.string().optional(),
      logoHorizontal: z.string().optional(),
      defaultHashtags: z.array(z.string()).optional(),
      defaultCtas: z.array(z.string()).optional(),
      examplePosts: z.array(z.string()).optional(),
      showBranding: z.boolean().optional(),
      anthropicApiKey: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { plannerId, ...data } = input;

    const planner = await prisma.nasaPlanner.update({
      where: { id: plannerId, organizationId: context.org.id },
      data,
    });

    return { planner };
  });
