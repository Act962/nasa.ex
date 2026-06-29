import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const publishAvatarTemplate = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/avatar-templates",
    summary: "Publish a Pipoya spritesheet as a shareable avatar template",
  })
  .input(
    z.object({
      name:       z.string().min(1).max(80),
      spriteUrl:  z.string().min(1),
      previewUrl: z.string().optional().nullable(),
      overlays:   z.unknown().optional(),
      isPublic:   z.boolean().default(false),
    }),
  )
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const template = await prisma.avatarTemplate.create({
      data: {
        name:       input.name,
        spriteUrl:  input.spriteUrl,
        previewUrl: input.previewUrl ?? null,
        overlays:   input.overlays as never ?? null,
        isPublic:   input.isPublic,
        authorId:   userId,
      },
    });
    return { template };
  });
