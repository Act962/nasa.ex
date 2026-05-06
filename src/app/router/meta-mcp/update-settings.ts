import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { canManageMcpAuthorizations } from "@/lib/meta-mcp/authorization";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

const ALLOWED_OPS = z.enum([
  "read",
  "pause",
  "resume",
  "create",
  "update",
  "delete",
  "catalog",
]);

const SUPPORTED_MODELS = z.enum([
  "openai:gpt-4.1-nano",
  "openai:gpt-4o",
  "anthropic:claude-sonnet-4",
  "anthropic:claude-opus-4",
  "google:gemini-2-flash",
]);

/**
 * Master/Moderador ajusta config do Astro Meta Ads:
 * - operações permitidas (whitelist)
 * - orçamento máximo por campanha
 * - modelo LLM default da org
 */
export const updateSettings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      allowedOps: z.array(ALLOWED_OPS).optional(),
      maxBudgetPerCampaign: z.number().min(0).max(1_000_000).optional(),
      defaultModel: SUPPORTED_MODELS.optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const canManage = await canManageMcpAuthorizations(
      context.user.id,
      context.org.id,
    );
    if (!canManage) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas Master e Moderador podem ajustar configurações.",
      });
    }

    const integration = await prisma.platformIntegration.findUnique({
      where: {
        organizationId_platform: {
          organizationId: context.org.id,
          platform: "META",
        },
      },
      select: { id: true, config: true },
    });
    if (!integration) {
      throw new ORPCError("NOT_FOUND", {
        message: "Integração Meta não encontrada.",
      });
    }

    const existing = (integration.config ?? {}) as Record<string, unknown>;
    const next = {
      ...existing,
      ...(input.allowedOps ? { mcpAllowedOps: input.allowedOps } : {}),
      ...(input.maxBudgetPerCampaign != null
        ? { mcpMaxBudgetPerCampaign: input.maxBudgetPerCampaign }
        : {}),
      ...(input.defaultModel ? { mcpDefaultModel: input.defaultModel } : {}),
    };

    await prisma.platformIntegration.update({
      where: { id: integration.id },
      data: { config: next },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "meta-ads-mcp",
      featureKey: "meta_mcp.settings.updated",
      action: "meta_mcp.settings.updated",
      actionLabel: `Atualizou configurações do Astro Meta Ads`,
      metadata: {
        allowedOps: next.mcpAllowedOps,
        maxBudgetPerCampaign: next.mcpMaxBudgetPerCampaign,
        defaultModel: next.mcpDefaultModel,
      },
    });

    return {
      mcpAllowedOps: next.mcpAllowedOps,
      mcpMaxBudgetPerCampaign: next.mcpMaxBudgetPerCampaign,
      mcpDefaultModel: next.mcpDefaultModel,
    };
  });
