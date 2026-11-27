import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { addActionChecklistItem } from "../lib/action-commands";

export const createSubAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      title: z.string().min(1, "Título é obrigatório"),
      finishDate: z.date().optional(),
      groupId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const subAction = await addActionChecklistItem({
      organizationId: context.org.id,
      actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      },
      actionId: input.actionId,
      title: input.title,
      finishDate: input.finishDate,
      groupId: input.groupId,
    });
    return { subAction };
  });
