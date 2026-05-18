import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listInsightsMembers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/insights/members",
    summary: "Lista membros para o filtro de atendentes do dashboard",
  })
  .input(
    z.object({
      organizationIds: z.array(z.string()).optional(),
      trackingIds: z.array(z.string()).optional(),
    }),
  )
  .output(
    z.object({
      members: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          image: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const { user, org } = context;
    const orgIds =
      input.organizationIds && input.organizationIds.length > 0
        ? input.organizationIds
        : [org.id];

    const callerMemberships = await prisma.member.findMany({
      where: { userId: user.id, organizationId: { in: orgIds } },
      select: { organizationId: true },
    });
    const allowedOrgIds = callerMemberships.map((m) => m.organizationId);

    if (allowedOrgIds.length === 0) {
      return { members: [] };
    }

    const hasTrackings =
      !!input.trackingIds && input.trackingIds.length > 0;

    const rows = await prisma.member.findMany({
      where: {
        organizationId: { in: allowedOrgIds },
        ...(hasTrackings
          ? {
              user: {
                trackings: {
                  some: { trackingId: { in: input.trackingIds! } },
                },
              },
            }
          : {}),
      },
      select: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Dedup por user.id (mesmo user pode ser membro de múltiplas orgs
    // selecionadas).
    const seen = new Set<string>();
    const members: { id: string; name: string; email: string; image: string | null }[] = [];
    for (const row of rows) {
      if (!row.user || seen.has(row.user.id)) continue;
      seen.add(row.user.id);
      members.push(row.user);
    }

    return { members };
  });
