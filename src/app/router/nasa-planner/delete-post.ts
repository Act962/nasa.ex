import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { assertPlannerOrganizationAccess, assertPostAccess } from "@/features/nasa-planner/server/cross-org";

export const deletePost = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    const { post } = await assertPostAccess(context.user.id, input.postId, "create");
    if (post.status === "PUBLISHING") {
      throw new ORPCError("BAD_REQUEST", { message: "Este post está sendo publicado agora. Espere terminar." });
    }
    // Excluir conteúdo de outra pessoa exige poder aprovar; o autor exclui o próprio.
    if (post.createdById !== context.user.id) await assertPlannerOrganizationAccess(context.user.id, post.organizationId, "approve");
    await prisma.nasaPlannerPost.delete({ where: { id: input.postId } });
    return { ok: true };
  });
