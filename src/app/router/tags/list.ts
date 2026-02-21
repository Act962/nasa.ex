import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";

export const listTags = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/tags",
  })
  .input(
    z.object({
      query: z
        .object({
          trackingId: z.string().optional(),
        })
        .optional(),
    }),
  )
  .output(
    z.object({
      tags: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          color: z.string().nullable().default("#1447e6"),
          description: z.string().nullable(),
          icon: z.string().nullable(),
          type: z.enum(["CUSTOM", "SYSTEM"]),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      // Query ao banco com tratamento
      const tags = await prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          description: true,
          icon: true,
          type: true,
        },
        where: {
          organizationId: context.org.id,
          ...(input.query?.trackingId && {
            trackingId: input.query.trackingId,
          }),
        },
        orderBy: {
          name: "asc",
        },
      });

      return {
        tags: tags.map((tag) => ({
          ...tag,
          color: tag.color ?? "#1447e6",
        })),
      };
    } catch (error) {
      if (error === errors.BAD_REQUEST || error === errors.UNAUTHORIZED) {
        throw error;
      }
      if (error instanceof Error) {
        if (
          error.message.includes("connection") ||
          error.message.includes("timeout")
        ) {
          throw errors.INTERNAL_SERVER_ERROR;
        }
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
