import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { assertPlannerOrganizationAccess, assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import { deletePublishGroupPosts, dissolvePublishGroupAfterDelete } from "@/features/nasa-planner/server/publish-group";

export const deletePost = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), scope: z.enum(["post", "group"]).default("post") }))
  .handler(async ({ input, context }) => {
    const { post, permissions } = await assertPostAccess(context.user.id, input.postId, "create");
    if (post.status === "PUBLISHING") {
      throw new ORPCError("BAD_REQUEST", { message: "Este post está sendo publicado agora. Espere terminar." });
    }
    // Excluir conteúdo de outra pessoa exige poder aprovar; o autor exclui o próprio.
    if (post.createdById !== context.user.id) await assertPlannerOrganizationAccess(context.user.id, post.organizationId, "approve");
    // "Todas as contas" (spec 0074, RF-16): o que já foi ou está sendo publicado fica.
    if (input.scope === "group" && post.publishGroupId) {
      const { deletedCount, keptCount } = await deletePublishGroupPosts(input.postId, { id: context.user.id, canDeleteOthersPosts: permissions.canApprove });
      return { ok: true, deletedCount, keptCount };
    }
    await prisma.nasaPlannerPost.delete({ where: { id: input.postId } });
    await dissolvePublishGroupAfterDelete(post.publishGroupId);
    return { ok: true, deletedCount: 1, keptCount: 0 };
  });
