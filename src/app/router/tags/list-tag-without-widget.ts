import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";

export const listTagsWithoutWidget = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/tags-without-widget",
  })
  .input(
    z.object({
      organizationIds: z.array(z.string()).optional(),
    }),
  )

  .handler(async ({ input, context, errors }) => {
    try {
      const { organizationIds } = input;

      let organizationIdFinded = await prisma.widget.findMany({
        where: {
          id: { in: organizationIds },
        },
        select: {
          id: true,
        },
      });

      if (!organizationIdFinded || organizationIdFinded.length === 0) {
        const myOrganizations = await prisma.member.findMany({
          where: {
            userId: context.user.id,
          },
          select: { organizationId: true },
        });

        organizationIdFinded = await prisma.organization.findMany({
          where: {
            id: {
              in: myOrganizations.map(
                (organization) => organization.organizationId,
              ),
            },
          },
          select: {
            id: true,
          },
        });
      }

      const widgets = await prisma.widget.findMany({
        where: {
          organizationId: {
            in: organizationIdFinded.map((organization) => organization.id),
          },
        },
        select: {
          config: true,
        },
      });

      const tagIdsFromWidgets = widgets.map((w) => {
        const config = w.config;
        if (config === null) {
          return;
        }
        const configFormated = JSON.parse(config as string);

        return configFormated.tagid;
      });

      // Query ao banco com tratamento
      const tags = await prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          whatsappId: true,
          description: true,
          icon: true,
          type: true,
          organizationId: true,
        },
        where: {
          organizationId: {
            in: organizationIds,
          },
          id: {
            notIn: tagIdsFromWidgets,
          },
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
