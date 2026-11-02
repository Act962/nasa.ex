import "server-only";

import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { registerProposalExecutor } from "@/features/astro/server/tools/_shared/proposals/types";
import { executeConfirmedMetaMcpWrite } from "./meta-mcp-tools";

/**
 * Executor do cartão de confirmação do chat principal do Astro para escritas na Meta
 * (spec 0125, RF-4 e RF-11). Registrado no import, como o do plano.
 */

export const META_MCP_WRITE_ACTION_TYPE = "meta-ads.mcp-write";

export interface MetaMcpWriteProposalPayload {
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  /** trafeGO: o evento vai para a linha do tempo do pedido. */
  orderId?: string | null;
}

registerProposalExecutor<MetaMcpWriteProposalPayload>(META_MCP_WRITE_ACTION_TYPE, async ({ ctx, payload }) => {
  const execution = await executeConfirmedMetaMcpWrite({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    toolName: payload.toolName,
    args: payload.args,
  });
  if (!execution.ok) return { ok: false, summary: execution.message };

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true, image: true } });
  await logActivity({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    userName: user?.name ?? "",
    userEmail: user?.email ?? "",
    userImage: user?.image,
    appSlug: "meta-ads-mcp",
    featureKey: payload.toolName,
    action: payload.toolName,
    actionLabel: payload.summary,
    metadata: { tool: payload.toolName, orderId: payload.orderId ?? null },
  });

  if (payload.orderId) {
    const order = await prisma.trafegoOrder.findFirst({
      where: { id: payload.orderId, organizationId: ctx.organizationId },
      select: { status: true },
    });
    if (order) {
      await prisma.trafegoOrderEvent
        .create({
          data: {
            orderId: payload.orderId,
            fromStatus: order.status,
            toStatus: order.status,
            title: "Campanha alterada pelo Astro",
            detail: `${payload.summary} · por ${user?.name || user?.email || "usuário"}`,
            isClientVisible: true,
            actorUserId: ctx.userId,
            source: "CLIENT",
          },
        })
        .catch((error: unknown) => console.error("[astro-meta-ads] evento do pedido não gravado", error));
    }
  }

  return { ok: true, summary: `Feito na Meta: ${payload.summary}` };
});
