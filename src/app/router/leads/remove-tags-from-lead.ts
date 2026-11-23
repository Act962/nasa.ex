import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";
import { removeLeadTagsRecord } from "@/features/leads/server/lead-commands";

export const removeTagsFromLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    path: "/leads/remove-tags",
    method: "POST",
  })
  .input(
    z.object({
      leadId: z.string(),
      tagIds: z.array(z.string()).min(1),
    }),
  )
  .handler(async ({ input, context }) => {
    return removeLeadTagsRecord({ actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      }, leadId: input.leadId, tagIds: input.tagIds });
  });
