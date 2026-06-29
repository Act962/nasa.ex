import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  loadSafetyConfig,
  checkOpAllowed,
  checkBudget,
  checkCampaignBelongsToOrg,
} from "@/lib/meta-mcp/safety";
import { setupMetaTool } from "./_shared";

/**
 * Helper: cria uma `MetaAdsPendingAction` com TTL 5min.
 * Tools propose-* não EXECUTAM — só persistem aqui pra confirmação UI.
 */
async function createPendingAction(opts: {
  organizationId: string;
  userId: string;
  toolName: string;
  payload: Record<string, unknown>;
  summary: string;
}) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
  return prisma.metaAdsPendingAction.create({
    data: {
      organizationId: opts.organizationId,
      userId: opts.userId,
      toolName: opts.toolName,
      payload: opts.payload as any,
      summary: opts.summary,
      expiresAt,
    },
  });
}

/** PROPOSE — pausar uma campanha. Exige campanha alvo. */
export const proposePauseCampaignTool = (userId: string, orgId: string) =>
  tool({
    description:
      "Propõe pausar uma campanha Meta. NÃO executa — apenas prepara confirmação. O usuário tem que clicar 'Confirmar' no card que aparece no chat.",
    inputSchema: z.object({
      campaignId: z.string().min(1).describe("metaCampaignId"),
      reason: z.string().optional().describe("Motivo (opcional, vai pro audit log)"),
    }),
    execute: async ({ campaignId, reason }) => {
      const setup = await setupMetaTool(userId, orgId);
      if (!setup.ok) return setup;
      try {
        const cfg = await loadSafetyConfig(orgId);
        const opErr = checkOpAllowed(cfg, "pause");
        if (opErr) return opErr;
        const ownErr = await checkCampaignBelongsToOrg(orgId, campaignId);
        if (ownErr) return ownErr;
        // Carrega snapshot do nome pra summary
        const camp = await prisma.metaAdCampaign.findFirst({
          where: { organizationId: orgId, metaCampaignId: campaignId },
          select: { name: true },
        });
        const summary = `Pausar campanha "${camp?.name ?? campaignId}".${
          reason ? ` Motivo: ${reason}.` : ""
        }`;
        const pending = await createPendingAction({
          organizationId: orgId,
          userId,
          toolName: "meta_ads_pause_campaign",
          payload: { campaignId, reason },
          summary,
        });
        return {
          ok: true as const,
          requiresConfirmation: true,
          pendingActionId: pending.id,
          summary,
          tool: "pause",
        };
      } finally {
        await setup.close();
      }
    },
  });

/** PROPOSE — retomar campanha pausada. */
export const proposeResumeCampaignTool = (userId: string, orgId: string) =>
  tool({
    description:
      "Propõe retomar (reativar) uma campanha Meta pausada. NÃO executa — usuário tem que confirmar.",
    inputSchema: z.object({
      campaignId: z.string().min(1),
    }),
    execute: async ({ campaignId }) => {
      const setup = await setupMetaTool(userId, orgId);
      if (!setup.ok) return setup;
      try {
        const cfg = await loadSafetyConfig(orgId);
        const opErr = checkOpAllowed(cfg, "resume");
        if (opErr) return opErr;
        const ownErr = await checkCampaignBelongsToOrg(orgId, campaignId);
        if (ownErr) return ownErr;
        const camp = await prisma.metaAdCampaign.findFirst({
          where: { organizationId: orgId, metaCampaignId: campaignId },
          select: { name: true },
        });
        const summary = `Retomar campanha "${camp?.name ?? campaignId}" (mudar status para ACTIVE).`;
        const pending = await createPendingAction({
          organizationId: orgId,
          userId,
          toolName: "meta_ads_resume_campaign",
          payload: { campaignId },
          summary,
        });
        return {
          ok: true as const,
          requiresConfirmation: true,
          pendingActionId: pending.id,
          summary,
          tool: "resume",
        };
      } finally {
        await setup.close();
      }
    },
  });

/** PROPOSE — atualizar campanha (orçamento, nome, audiência). */
export const proposeUpdateCampaignTool = (userId: string, orgId: string) =>
  tool({
    description:
      "Propõe alterar parâmetros de uma campanha Meta (nome, orçamento). NÃO executa — usuário confirma.",
    inputSchema: z.object({
      campaignId: z.string().min(1),
      changes: z.object({
        name: z.string().optional(),
        dailyBudgetReais: z.number().min(0).optional(),
      }),
    }),
    execute: async ({ campaignId, changes }) => {
      const setup = await setupMetaTool(userId, orgId);
      if (!setup.ok) return setup;
      try {
        const cfg = await loadSafetyConfig(orgId);
        const opErr = checkOpAllowed(cfg, "update");
        if (opErr) return opErr;
        if (changes.dailyBudgetReais != null) {
          const bErr = checkBudget(cfg, changes.dailyBudgetReais);
          if (bErr) return bErr;
        }
        const ownErr = await checkCampaignBelongsToOrg(orgId, campaignId);
        if (ownErr) return ownErr;
        const camp = await prisma.metaAdCampaign.findFirst({
          where: { organizationId: orgId, metaCampaignId: campaignId },
          select: { name: true },
        });
        const parts: string[] = [];
        if (changes.name) parts.push(`renomear para "${changes.name}"`);
        if (changes.dailyBudgetReais != null)
          parts.push(`orçamento diário R$ ${changes.dailyBudgetReais.toFixed(2)}`);
        const summary = `Atualizar "${camp?.name ?? campaignId}": ${
          parts.join(", ") || "(sem mudanças)"
        }.`;
        const pending = await createPendingAction({
          organizationId: orgId,
          userId,
          toolName: "meta_ads_update_campaign",
          payload: { campaignId, changes },
          summary,
        });
        return {
          ok: true as const,
          requiresConfirmation: true,
          pendingActionId: pending.id,
          summary,
          tool: "update",
        };
      } finally {
        await setup.close();
      }
    },
  });

/** PROPOSE — criar uma campanha nova. */
export const proposeCreateCampaignTool = (userId: string, orgId: string) =>
  tool({
    description:
      "Propõe criar uma nova campanha Meta. NÃO executa — usuário confirma com resumo dos parâmetros.",
    inputSchema: z.object({
      name: z.string().min(3).max(120),
      objective: z
        .enum([
          "OUTCOME_AWARENESS",
          "OUTCOME_TRAFFIC",
          "OUTCOME_ENGAGEMENT",
          "OUTCOME_LEADS",
          "OUTCOME_SALES",
          "OUTCOME_APP_PROMOTION",
        ])
        .describe("Objetivo Meta padrão"),
      dailyBudgetReais: z.number().min(1).max(100_000),
      startNow: z.boolean().default(true),
    }),
    execute: async ({ name, objective, dailyBudgetReais, startNow }) => {
      const setup = await setupMetaTool(userId, orgId);
      if (!setup.ok) return setup;
      try {
        const cfg = await loadSafetyConfig(orgId);
        const opErr = checkOpAllowed(cfg, "create");
        if (opErr) return opErr;
        const bErr = checkBudget(cfg, dailyBudgetReais);
        if (bErr) return bErr;
        const summary = `Criar campanha "${name}" (${objective}) com R$ ${dailyBudgetReais.toFixed(2)}/dia, ${startNow ? "iniciando agora" : "pausada"}.`;
        const pending = await createPendingAction({
          organizationId: orgId,
          userId,
          toolName: "meta_ads_create_campaign",
          payload: { name, objective, dailyBudgetReais, startNow },
          summary,
        });
        return {
          ok: true as const,
          requiresConfirmation: true,
          pendingActionId: pending.id,
          summary,
          tool: "create",
        };
      } finally {
        await setup.close();
      }
    },
  });

/** PROPOSE — criar um anúncio dentro de uma campanha. Exige campanha. */
export const proposeCreateAdTool = (userId: string, orgId: string) =>
  tool({
    description:
      "Propõe criar um anúncio dentro de uma campanha existente. EXIGE campaignId. NÃO executa — usuário confirma.",
    inputSchema: z.object({
      campaignId: z.string().min(1),
      name: z.string().min(3).max(120),
      creativeBrief: z
        .string()
        .describe("Descrição textual do criativo. O usuário gera/sobe a imagem em outro fluxo."),
    }),
    execute: async ({ campaignId, name, creativeBrief }) => {
      const setup = await setupMetaTool(userId, orgId);
      if (!setup.ok) return setup;
      try {
        const cfg = await loadSafetyConfig(orgId);
        const opErr = checkOpAllowed(cfg, "create");
        if (opErr) return opErr;
        const ownErr = await checkCampaignBelongsToOrg(orgId, campaignId);
        if (ownErr) return ownErr;
        const camp = await prisma.metaAdCampaign.findFirst({
          where: { organizationId: orgId, metaCampaignId: campaignId },
          select: { name: true },
        });
        const summary = `Criar anúncio "${name}" dentro da campanha "${camp?.name ?? campaignId}". Criativo: ${creativeBrief}.`;
        const pending = await createPendingAction({
          organizationId: orgId,
          userId,
          toolName: "meta_ads_create_ad",
          payload: { campaignId, name, creativeBrief },
          summary,
        });
        return {
          ok: true as const,
          requiresConfirmation: true,
          pendingActionId: pending.id,
          summary,
          tool: "create_ad",
        };
      } finally {
        await setup.close();
      }
    },
  });
