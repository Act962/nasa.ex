import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isTrackingAccessibleByUser } from "@/features/workspace/lib/tracking-link";
import { createWorkspaceRecord } from "../lib/workspace-commands";
import { z } from "zod";

export const createWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      icon: z.string().optional(),
      trackingId: z.string().optional(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
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

    const workspace = await createWorkspaceRecord({
      organizationId: context.org.id,
      userId: context.user.id,
      name: input.name,
      description: input.description,
      icon: input.icon,
      trackingId: input.trackingId,
    });

    return {
      workspace,
    };
  });
