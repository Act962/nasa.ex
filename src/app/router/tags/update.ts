import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { slugify } from "@/lib/utils";

export const updateTag = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      tagId: z.string(),
      name: z.string(),
      color: z.string(),
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

    const slug = slugify(input.name);

    return await prisma.tag.update({
      where: {
        id: input.tagId,
      },
      data: {
        name: input.name,
        slug: slug,
        color: input.color,
      },
    });
  });
