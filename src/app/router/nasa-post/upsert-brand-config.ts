import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const upsertBrandConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      brandName: z.string().min(1).max(100),
      brandSlogan: z.string().optional(),
      website: z.string().optional(),
      icp: z.string().optional(),
      swot: z
        .object({
          strengths: z.string().optional(),
          weaknesses: z.string().optional(),
          opportunities: z.string().optional(),
          threats: z.string().optional(),
        })
        .optional(),
      positioning: z.string().optional(),
      toneOfVoice: z.string().optional(),
      keyMessages: z.array(z.string()).optional(),
      forbiddenWords: z.array(z.string()).optional(),
      primaryColors: z.array(z.string()).optional(),
      secondaryColors: z.array(z.string()).optional(),
      fonts: z
        .object({
          heading: z.string().optional(),
          body: z.string().optional(),
          accent: z.string().optional(),
        })
        .optional(),
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
    const data = {
      brandName: input.brandName,
      brandSlogan: input.brandSlogan ?? null,
      website: input.website ?? null,
      icp: input.icp ?? null,
      swot: input.swot ?? {},
      positioning: input.positioning ?? null,
      toneOfVoice: input.toneOfVoice ?? null,
      keyMessages: input.keyMessages ?? [],
      forbiddenWords: input.forbiddenWords ?? [],
      primaryColors: input.primaryColors ?? [],
      secondaryColors: input.secondaryColors ?? [],
      fonts: input.fonts ?? {},
      logoLight: input.logoLight ?? null,
      logoDark: input.logoDark ?? null,
      logoSquare: input.logoSquare ?? null,
      logoHorizontal: input.logoHorizontal ?? null,
      defaultHashtags: input.defaultHashtags ?? [],
      defaultCtas: input.defaultCtas ?? [],
      examplePosts: input.examplePosts ?? [],
      showBranding: input.showBranding ?? true,
      anthropicApiKey: input.anthropicApiKey ?? null,
    };

    const config = await prisma.nasaPostBrandConfig.upsert({
      where: { organizationId: context.org.id },
      create: { organizationId: context.org.id, ...data },
      update: data,
    });

    return { config };
  });
