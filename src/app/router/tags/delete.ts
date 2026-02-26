import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const deleteTag = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      tagId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const tag = await prisma.tag.findUnique({
      where: {
        id: input.tagId,
      },
    });

    if (!tag) {
      throw errors.BAD_REQUEST({
        message: "Tag não encontrada",
      });
    }

    return await prisma.tag.delete({
      where: {
        id: input.tagId,
      },
    });
  });
