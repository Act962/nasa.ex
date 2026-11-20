import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { addActionParticipant } from "../lib/action-commands";

export const addParticipant = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const participant = await addActionParticipant({
      organizationId: context.org.id,
      actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      },
      actionId: input.actionId,
      userId: input.userId,
    });
    return { participant };
  });
