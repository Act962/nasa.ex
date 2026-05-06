import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { debitStars } from "@/lib/star-service";
import { StarTransactionType } from "@/generated/prisma/enums";
import { checkMcpAuthorization } from "@/lib/meta-mcp/authorization";
import { createMetaMcpClient } from "@/lib/meta-mcp/client";
import { getMetaAuth } from "@/app/router/meta-ads/_helpers";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

/**
 * Executa uma `MetaAdsPendingAction` previamente proposta pelo Astro.
 *
 * Validações em cadeia:
 *  1. Pending existe + status="pending" + não expirou + ownership do user
 *  2. Re-checa autorização MCP (revoke pode ter rolado entre propose e confirm)
 *  3. Carrega MetaAuth + cria client
 *  4. Executa op correspondente ao toolName
 *  5. Marca como "executed", debita Stars, registra em SystemActivityLog
 *
 * Falhas marcam status="executed" com errorMessage pra rastreabilidade.
 */

const STARS_PER_TOOL: Record<string, number> = {
  meta_ads_create_campaign: 5,
  meta_ads_update_campaign: 5,
  meta_ads_pause_campaign: 2,
  meta_ads_resume_campaign: 2,
  meta_ads_create_ad: 5,
};

export const executeMcpAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ pendingActionId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    // 1. Carrega pending
    const pending = await prisma.metaAdsPendingAction.findUnique({
      where: { id: input.pendingActionId },
    });
    if (!pending) {
      throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada." });
    }
    if (pending.organizationId !== context.org.id || pending.userId !== context.user.id) {
      throw new ORPCError("FORBIDDEN", {
        message: "Você não tem acesso a essa ação.",
      });
    }
    if (pending.status !== "pending") {
      throw new ORPCError("CONFLICT", {
        message: `Ação já está com status "${pending.status}".`,
      });
    }
    if (pending.expiresAt < new Date()) {
      await prisma.metaAdsPendingAction.update({
        where: { id: pending.id },
        data: { status: "expired" },
      });
      throw new ORPCError("PRECONDITION_FAILED", {
        message: "Essa ação expirou (TTL 5min). Peça ao Astro novamente.",
      });
    }

    // 2. Re-checa autorização (revoke pode ter rolado entre propose e confirm)
    const auth = await checkMcpAuthorization(context.user.id, context.org.id);
    if (!auth.authorized) {
      throw new ORPCError("FORBIDDEN", {
        message: "Você não é autorizado a realizar essa operação.",
      });
    }

    // 3. Lock condicional: passa pra "executing" só se ainda está "pending"
    const locked = await prisma.metaAdsPendingAction.updateMany({
      where: { id: pending.id, status: "pending" },
      data: { status: "executing" as any },
    });
    if (locked.count === 0) {
      throw new ORPCError("CONFLICT", {
        message: "Outra confirmação chegou primeiro.",
      });
    }

    // 4. Auth Meta + client
    const metaAuth = await getMetaAuth(context.org.id, { userId: context.user.id });
    if (!metaAuth) {
      await prisma.metaAdsPendingAction.update({
        where: { id: pending.id },
        data: {
          status: "pending",
          errorMessage: "Integração Meta não conectada.",
        },
      });
      throw new ORPCError("PRECONDITION_FAILED", {
        message: "Integração Meta não conectada.",
      });
    }
    const client = await createMetaMcpClient(metaAuth);

    let executionResult: Record<string, unknown> = {};
    try {
      const payload = pending.payload as Record<string, any>;
      switch (pending.toolName) {
        case "meta_ads_pause_campaign":
          await client.pauseCampaign({ campaignId: payload.campaignId });
          executionResult = { paused: payload.campaignId };
          break;
        case "meta_ads_resume_campaign":
          await client.resumeCampaign({ campaignId: payload.campaignId });
          executionResult = { resumed: payload.campaignId };
          break;
        case "meta_ads_update_campaign":
        case "meta_ads_create_campaign":
        case "meta_ads_create_ad":
          // Stub — implementação completa quando MCP server da Meta expor.
          executionResult = {
            stub: true,
            message:
              "Operação registrada como pendente, mas execução completa requer MCP server ativo (env META_MCP_SERVER_CMD) ou extensão da Marketing API direta.",
          };
          break;
        default:
          throw new Error(`Tool desconhecida: ${pending.toolName}`);
      }

      // 5. Marca como executed
      await prisma.metaAdsPendingAction.update({
        where: { id: pending.id },
        data: { status: "executed", executedAt: new Date() },
      });

      // 6. Stars debit
      const stars = STARS_PER_TOOL[pending.toolName] ?? 1;
      try {
        await debitStars(
          context.org.id,
          stars,
          StarTransactionType.APP_CHARGE,
          `Astro Meta Ads — ${pending.toolName}`,
          "meta-ads-mcp",
          context.user.id,
        );
      } catch (e) {
        // Saldo insuficiente não desfaz a operação Meta — só loga.
        // eslint-disable-next-line no-console
        console.warn("[meta-mcp:execute] stars debit failed", e);
      }

      // 7. Activity log
      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "meta-ads-mcp",
        featureKey: pending.toolName,
        action: pending.toolName,
        actionLabel: pending.summary,
        resourceId: pending.id,
        metadata: {
          tool: pending.toolName,
          payload: pending.payload,
          result: executionResult,
        },
      });

      return {
        ok: true,
        executionResult,
        summary: pending.summary,
        tool: pending.toolName,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      await prisma.metaAdsPendingAction.update({
        where: { id: pending.id },
        data: { status: "pending", errorMessage: message },
      });
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message });
    } finally {
      await client.close();
    }
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
