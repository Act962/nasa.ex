import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const getAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const action = await prisma.action.findUnique({
      where: {
        id: input.actionId,
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                email: true,
              },
            },
          },
        },
        responsibles: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                email: true,
              },
            },
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        subActions: {
          include: {
            responsibles: {
              select: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true,
          },
        },
        column: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
    });

    if (!action) return { action: null, hasAccess: false };

    // 1. Is participant?
    const isParticipant = action.participants.some(
      (p) => p.userId === context.user.id,
    );

    // 2. Is workspace owner?
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: action.workspaceId,
          userId: context.user.id,
        },
      },
    });
    const isWorkspaceOwner = workspaceMember?.role === "OWNER";

    // 3. Is organization owner/admin?
    const orgMember = (context.org.members as any[]).find(
      (m: any) => m.userId === context.user.id,
    );
    const canSeeByOrg =
      orgMember?.role === "owner" ||
      orgMember?.role === "admin" ||
      orgMember?.role === "moderador";

    const hasAccess = isParticipant || isWorkspaceOwner || canSeeByOrg;

    return { action, hasAccess };
  });
