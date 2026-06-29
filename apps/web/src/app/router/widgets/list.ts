import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listWidgets = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/widgets",
    summary: "List widgets",
  })
  .input(
    z.object({
      organizationIds: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context }) => {
    const { organizationIds } = input;

    let organizationIdFinded = await prisma.organization.findMany({
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
    });
    return widgets;
  });
