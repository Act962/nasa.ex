import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { slugify } from "@/lib/utils";

export const createTag = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/tags",
  })
  .input(
    z.object({
      name: z.string().trim().min(2),
      color: z.string().nullable().default("#1447e6"),
      description: z.string().trim().nullable().default(null),
      icon: z.string().trim().nullable().default(null),
      trackingId: z.string(),
    }),
  )
  .output(
    z.object({
      tagId: z.string(),
      tagName: z.string(),
      tagSlug: z.string(),
      trackingId: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const tagExists = await prisma.tag.findUnique({
        where: {
          name_organizationId_trackingId: {
            name: input.name,
            organizationId: context.org.id,
            trackingId: input.trackingId,
          },
        },
      });

      if (tagExists) {
        throw errors.BAD_REQUEST({
          message: "Tag já existe",
          cause: "TAG_ALREADY_EXISTS",
        });
      }

      const slug = slugify(input.name);

      const tag = await prisma.tag.create({
        data: {
          name: input.name,
          slug: slug,
          color: input.color,
          description: input.description,
          icon: input.icon,
          organizationId: context.org.id,
          trackingId: input.trackingId,
        },
      });

      return {
        tagId: tag.id,
        tagName: tag.name,
        tagSlug: tag.slug,
        trackingId: tag.trackingId,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR({ message: "Erro ao criar tag" });
    }
  });
