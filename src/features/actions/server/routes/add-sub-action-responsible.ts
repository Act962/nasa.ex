import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findSubActionInOrg, isOrgMember } from "../lib/action-access";

export const addSubActionResponsible = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      subActionId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const subAction = await findSubActionInOrg(
      input.subActionId,
      context.org.id,
    );
    if (!subAction) {
      throw errors.NOT_FOUND({ message: "Sub-ação não encontrada" });
    }

    if (!(await isOrgMember(input.userId, context.org.id))) {
      throw errors.FORBIDDEN({
        message: "Usuário não pertence a esta organização",
      });
    }

    const responsible = await prisma.subActionUserResponsible.upsert({
      where: {
        userId_subActionId: {
          userId: input.userId,
          subActionId: input.subActionId,
        },
      },
      create: {
        userId: input.userId,
        subActionId: input.subActionId,
      },
      update: {},
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
        subAction: {
          include: {
            action: {
              select: { id: true, workspaceId: true },
            },
          },
        },
      },
    });

    return { responsible };
  });
