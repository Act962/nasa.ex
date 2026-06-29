import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireModerator } from "../utils";

const annotationSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  angle: z.number().default(0),
  label: z.string().default(""),
  marker: z.enum(["rocket-right", "rocket-left", "arrow"]).optional(),
});

export const upsertStep = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      featureId: z.string(),
      title: z.string().min(1),
      description: z.string().min(1),
      screenshotUrl: z.string().optional().nullable(),
      annotations: z.array(annotationSchema).optional(),
      order: z.number().int().default(0),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireModerator(context.user.id);
    const { id, annotations, ...rest } = input;
    const data = { ...rest, annotations: annotations as any };
    if (id) {
      return await prisma.spaceHelpStep.update({ where: { id }, data });
    }
    return await prisma.spaceHelpStep.create({ data });
  });
