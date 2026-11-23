import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { EVENT_CATEGORY_VALUES, updateWorkspaceAction } from "../lib/action-commands";

export const updateAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      columnId: z.string().nullable().optional(),
      dueDate: z.date().nullable().optional(),
      startDate: z.date().nullable().optional(),
      endDate: z.date().nullable().optional(),
      isDone: z.boolean().optional(),
      orgProjectId: z.string().nullable().optional(),
      isPublic: z.boolean().optional(),
      eventCategory: z.enum(EVENT_CATEGORY_VALUES).nullable().optional(),
      country: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      registrationUrl: z.string().nullable().optional(),
      /** Obrigatório quando isPublic=true e o evento era privado: protege contra chamadas que pulam o PublicVisibilityDialog. */
      consent: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const action = await updateWorkspaceAction({
      org: context.org,
      actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      },
      input,
    });
    return { action };
  });
