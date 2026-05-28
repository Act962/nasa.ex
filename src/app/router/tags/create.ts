import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { logActivity } from "@/features/admin/lib/activity-logger";
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
      /** Quando null/omitted, tag é ORG-WIDE (visível em todos os trackings).
       *  Quando setado, tag fica restrita a esse tracking (legacy mode). */
      trackingId: z.string().nullable().optional(),
      /** Grupo opcional (TagGroup.id). Null = "Sem categoria". */
      tagGroupId: z.string().nullable().optional(),
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
      const trackingId = input.trackingId ?? null;

      // Unique constraint considera trackingId NULL como valor distinto.
      // Pra evitar duplicata org-wide, busca explícita pelo composite key.
      const tagExists = await prisma.tag.findFirst({
        where: {
          name: input.name,
          organizationId: context.org.id,
          trackingId,
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
          trackingId,
          tagGroupId: input.tagGroupId ?? null,
        },
      });

      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        action: "tag.created",
        actionLabel: `Criou a tag "${tag.name}"`,
        resource: tag.name,
        resourceId: tag.id,
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
