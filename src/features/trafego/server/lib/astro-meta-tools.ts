import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { prepareMetaMcpWrite, runMetaMcpRead } from "@/features/astro-meta-ads/server/meta-mcp-tools";
import {
  META_MCP_WRITE_ACTION_TYPE,
  type MetaMcpWriteProposalPayload,
} from "@/features/astro-meta-ads/server/astro-proposal-executor";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import { resolveCampaignBuilderAccess } from "./campaign-builder/builder-access";
import { listOrderCampaigns } from "./campaign-builder/builder-context";

/**
 * Meta pelo Astro dentro do painel trafeGO (spec 0125, RF-10): só as campanhas do pedido,
 * com a mesma guarda da aba Publicar (spec 0124). Criar campanha fica na aba Publicar.
 */

const WRITE_TOOLS_IN_TRAFEGO = ["ads_update_entity", "ads_activate_entity"] as const;

function newConversationId(): string {
  return randomBytes(15).toString("base64").replace(/[^A-Za-z0-9]/g, "").padEnd(20, "x").slice(0, 20);
}

export function buildTrafegoMetaAstroTools(ctx: AgentContext): ToolSet {
  const conversationId = newConversationId();

  /** Pedido da org + guarda do construtor + ids das campanhas do pedido na conta. */
  async function resolveOrderCampaigns(code?: string | null) {
    const order = await prisma.trafegoOrder.findFirst({
      where: { organizationId: ctx.organizationId, ...(code ? { code: code.trim().toUpperCase() } : {}) },
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true },
    });
    if (!order) return { ok: false as const, message: "Não encontrei essa campanha." };
    const access = await resolveCampaignBuilderAccess({
      orderId: order.id,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    });
    if (!access.ok) return { ok: false as const, message: access.message };
    const campaigns = await listOrderCampaigns(access.meta, access.order).catch(() => []);
    return { ok: true as const, order, campaigns };
  }

  return {
    meta_campanhas_do_pedido: tool({
      description:
        "Números reais das campanhas deste pedido na conta da Meta (gasto, conversas, alcance, status). Só funciona para o dono ou administrador da empresa.",
      inputSchema: z.object({
        code: z.string().optional().describe("Código da campanha trafeGO, ex: TG-0007"),
        datePreset: z.enum(["today", "yesterday", "last_7d", "last_30d", "maximum"]).default("last_7d"),
      }),
      execute: async ({ code, datePreset }) => {
        const resolved = await resolveOrderCampaigns(code);
        if (!resolved.ok) return resolved;
        const allowedEntityIds = resolved.campaigns.map((campaign) => campaign.id);
        return runMetaMcpRead({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          conversationId,
          toolName: "ads_get_ad_entities",
          args: {
            level: "campaign",
            object_ids: allowedEntityIds,
            fields: ["id", "name", "effective_status", "amount_spent", "results", "cost_per_result", "reach", "lifetime_budget"],
            date_preset: datePreset,
          },
          scope: { allowedEntityIds },
        });
      },
    }),

    meta_propor_mudanca_na_campanha: tool({
      description:
        "PROPÕE pausar, retomar ou mudar a verba total de uma campanha deste pedido. Não executa: o cliente confirma no cartão. Nunca diga que já foi feito.",
      inputSchema: z.object({
        code: z.string().optional(),
        campaignId: z.string().regex(/^\d{1,30}$/).describe("Id da campanha na Meta, vindo de meta_campanhas_do_pedido"),
        action: z.enum(["pause", "resume", "budget"]),
        lifetimeBudgetReais: z.number().positive().optional().describe("Nova verba total, só para action=budget"),
      }),
      execute: async ({ code, campaignId, action, lifetimeBudgetReais }) => {
        const resolved = await resolveOrderCampaigns(code);
        if (!resolved.ok) return resolved;
        const allowedEntityIds = resolved.campaigns.map((campaign) => campaign.id);
        if (action === "budget" && !lifetimeBudgetReais) {
          return { ok: false as const, message: "Diga o novo valor total da verba." };
        }
        const isActivation = action === "resume";
        const toolName = isActivation ? "ads_activate_entity" : "ads_update_entity";
        const prepared = await prepareMetaMcpWrite({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          conversationId,
          toolName,
          args: isActivation
            ? { entity_id: campaignId, entity_type: "campaign", publish_as_active: true }
            : {
                entity_id: campaignId,
                entity_type: "campaign",
                fields: JSON.stringify(
                  action === "pause" ? { status: "PAUSED" } : { lifetime_budget: Math.round((lifetimeBudgetReais ?? 0) * 100) },
                ),
              },
          scope: { allowedEntityIds, writeTools: WRITE_TOOLS_IN_TRAFEGO },
        });
        if (!prepared.ok) return prepared;
        // Cartão do chat principal do Astro: só o "Confirmar" executa (RF-4).
        const payload: MetaMcpWriteProposalPayload = {
          toolName,
          args: prepared.args,
          summary: prepared.summary,
          orderId: resolved.order.id,
        };
        return createPendingAction({
          ctx,
          actionType: META_MCP_WRITE_ACTION_TYPE,
          payload: payload as unknown as Record<string, unknown>,
          title: isActivation ? "Retomar campanha na Meta" : action === "pause" ? "Pausar campanha na Meta" : "Mudar verba na Meta",
          lines: [
            { label: "Campanha", value: resolved.order.code },
            { label: "O que muda", value: prepared.summary },
          ],
          warnings: isActivation ? ["A partir daqui a Meta volta a gastar a verba."] : undefined,
        });
      },
    }),
  };
}

export const TRAFEGO_META_SCOPE_PROMPT = `
- Para números reais das campanhas use meta_campanhas_do_pedido. Para pausar, retomar
  ou mudar a verba use meta_propor_mudanca_na_campanha: ela só prepara um cartão e o
  cliente confirma. Criar campanha nova é pela aba Publicar do painel.
`.trim();
