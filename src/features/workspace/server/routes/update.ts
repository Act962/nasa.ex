import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isTrackingAccessibleByUser } from "@/features/workspace/lib/tracking-link";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      coverImage: z.string().nullable().optional(),
      // `null` desvincula do tracking; `undefined` mantém o vínculo atual.
      trackingId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    const existingWorkspace = await prisma.workspace.findFirst({
      where: {
        id: input.workspaceId,
        organizationId: context.org.id,
      },
      select: { id: true, trackingId: true },
    });

    if (!existingWorkspace) {
      throw errors.NOT_FOUND({
        message: "Workspace não encontrado",
      });
    }

    if (input.trackingId) {
      const isAccessible = await isTrackingAccessibleByUser({
        trackingId: input.trackingId,
        organizationId: context.org.id,
        userId: context.user.id,
      });

      if (!isAccessible) {
        throw errors.FORBIDDEN({
          message: "Tracking não encontrado ou sem acesso",
        });
      }
    }

    // `undefined` significa "não mexer no vínculo"; qualquer outro valor
    // (inclusive `null`, que desvincula) precisa descer pras actions.
    const isChangingTracking =
      input.trackingId !== undefined &&
      input.trackingId !== existingWorkspace.trackingId;

    const workspace = await prisma.$transaction(async (tx) => {
      const updated = await tx.workspace.update({
        where: { id: input.workspaceId },
        data: {
          name: input.name,
          description: input.description,
          icon: input.icon,
          color: input.color,
          coverImage: input.coverImage,
          trackingId: input.trackingId,
        },
      });

      // Sem esta cascata, as actions que já existiam no workspace ficariam
      // com o tracking antigo (ou nulo) — só as criadas depois herdariam.
      if (isChangingTracking) {
        await tx.action.updateMany({
          where: { workspaceId: input.workspaceId },
          data: { trackingId: input.trackingId ?? null },
        });
      }

      return updated;
    });

    return { workspace };
  });
