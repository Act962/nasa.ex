import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { checkMcpAuthorization } from "@/features/astro-meta-ads/server/authorization";
import { executeConfirmedMetaMcpWrite } from "@/features/astro-meta-ads/server/meta-mcp-tools";
import { isMetaMcpWriteTool } from "@/features/astro-meta-ads/lib/mcp-guards";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Executa uma `MetaAdsPendingAction` proposta pelo Astro, pelo MCP oficial da Meta (spec 0125).
 *
 *  1. Pendência existe, é do usuário, está "pending" e não venceu
 *  2. Autorização re-checada (pode ter sido revogada entre propor e confirmar)
 *  3. Claim atômico "pending" → "executing" (dois cliques executam uma vez)
 *  4. Chama a ferramenta real com a conta da org reinjetada
 *  5. Só com sucesso: "executed", Stars e registro. Falha volta a "pending" com o erro, sem cobrar.
 */

export const executeMcpAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ pendingActionId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const pending = await prisma.metaAdsPendingAction.findUnique({ where: { id: input.pendingActionId } });
    if (!pending) throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada." });
    if (pending.organizationId !== context.org.id || pending.userId !== context.user.id) {
      throw new ORPCError("FORBIDDEN", { message: "Você não tem acesso a essa ação." });
    }
    if (pending.status !== "pending") {
      throw new ORPCError("CONFLICT", { message: `Ação já está com status "${pending.status}".` });
    }
    if (pending.expiresAt < new Date()) {
      await prisma.metaAdsPendingAction.update({ where: { id: pending.id }, data: { status: "expired" } });
      throw new ORPCError("PRECONDITION_FAILED", { message: "Essa ação venceu (5 min). Peça ao Astro de novo." });
    }
    if (!isMetaMcpWriteTool(pending.toolName)) {
      await prisma.metaAdsPendingAction.update({ where: { id: pending.id }, data: { status: "cancelled" } });
      throw new ORPCError("PRECONDITION_FAILED", { message: "Essa ação é de uma versão antiga do Astro. Peça de novo." });
    }

    const authorization = await checkMcpAuthorization(context.user.id, context.org.id);
    if (!authorization.authorized) {
      throw new ORPCError("FORBIDDEN", { message: "Você não é autorizado a realizar essa operação." });
    }
    const locked = await prisma.metaAdsPendingAction.updateMany({
      where: { id: pending.id, status: "pending" },
      data: { status: "executing" },
    });
    if (locked.count === 0) throw new ORPCError("CONFLICT", { message: "Outra confirmação chegou primeiro." });

    const execution = await executeConfirmedMetaMcpWrite({
      organizationId: context.org.id,
      userId: context.user.id,
      toolName: pending.toolName,
      args: pending.payload as Record<string, unknown>,
    });
    if (!execution.ok) {
      await prisma.metaAdsPendingAction.update({ where: { id: pending.id }, data: { status: "pending", errorMessage: execution.message } });
      throw new ORPCError("BAD_REQUEST", { message: execution.message });
    }
    const executionResult = execution.result;

    await prisma.metaAdsPendingAction.update({
      where: { id: pending.id },
      data: { status: "executed", executedAt: new Date(), errorMessage: null },
    });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: context.user.image,
      appSlug: "meta-ads-mcp",
      featureKey: pending.toolName,
      action: pending.toolName,
      actionLabel: pending.summary,
      resourceId: pending.id,
      metadata: { tool: pending.toolName, payload: pending.payload as Record<string, unknown> },
    });

    return { ok: true, executionResult, summary: pending.summary, tool: pending.toolName };
  });

/**
 * Cancela uma pending action (sem efeito; só atualiza status).
 */
export const cancelMcpAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ pendingActionId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const pending = await prisma.metaAdsPendingAction.findUnique({
      where: { id: input.pendingActionId },
    });
    if (
      !pending ||
      pending.organizationId !== context.org.id ||
      pending.userId !== context.user.id
    ) {
      throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada." });
    }
    if (pending.status !== "pending") return { ok: true, alreadyDone: true };
    await prisma.metaAdsPendingAction.update({
      where: { id: pending.id },
      data: { status: "cancelled" },
    });
    return { ok: true, cancelled: true };
  });
