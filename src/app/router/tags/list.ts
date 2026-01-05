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
    })
  )
  .output(
    z.object({
      tags: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          color: z.string().nullable().default("#1447e6"),
        })
      ),
    })
  )
  .handler(async ({ input, context, errors }) => {
    try {
      // Query ao banco com tratamento
      const tags = await prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          color: true,
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
      // Log do erro para debug (opcional, mas recomendado)
      console.error("[listTags] Error:", error);

      // Se for um erro conhecido do orpc, repassa
      if (error === errors.BAD_REQUEST || error === errors.UNAUTHORIZED) {
        throw error;
      }

      // Para erros de banco de dados do Prisma
      if (error instanceof Error) {
        // Erros de conexão do Prisma
        if (
          error.message.includes("connection") ||
          error.message.includes("timeout")
        ) {
          throw errors.INTERNAL_SERVER_ERROR;
        }
      }

      // Qualquer outro erro não tratado
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
