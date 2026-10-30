import "server-only";

import { jsonSchema, tool, type Tool } from "ai";
import prisma from "@/lib/prisma";
import { meter } from "@/features/stars/lib/metering";
import { readMetaAccessToken } from "@/features/integrations/lib/integration-api-key";
import { connectAdsMcp, type AdsMcpConnection, type AdsMcpToolInfo } from "@/http/meta/ads-mcp-client";
import { MetaGraphError } from "@/http/meta/graph-client";
import {
  buildWriteSummary,
  checkAdTextPolicy,
  checkBudgetCap,
  injectOrgAccount,
  isMetaMcpReadTool,
  isMetaMcpWriteTool,
  resolveSafetyOp,
  stripServerFilledArgs,
  truncateForModel,
  type MetaMcpWriteTool,
} from "../lib/mcp-guards";
import { checkMcpAuthorization, unauthorizedMessage } from "./authorization";
import { checkOpAllowed, loadSafetyConfig } from "./safety";

/**
 * Ferramentas do Astro sobre o MCP oficial da Meta (spec 0125). A conta é sempre a da
 * integração da org (D-3); escrita só vira proposta com cartão (RF-4).
 */

export type MetaMcpToolError = { ok: false; error: string; message: string };

export interface OrgMetaMcpAccess {
  ok: true;
  accessToken: string;
  adAccountId: string;
}

const PENDING_TTL_MS = 5 * 60 * 1000;
const MAX_DESCRIPTION_CHARS = 1_200;

/** Token e conta só da integração Meta da org nos Satélites (RF-2). */
export async function resolveOrgMetaMcpAccess(organizationId: string): Promise<OrgMetaMcpAccess | MetaMcpToolError> {
  const integration = await prisma.platformIntegration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "META" } },
    select: { isActive: true, config: true },
  });
  const config = (integration?.config ?? null) as Record<string, unknown> | null;
  const accessToken = readMetaAccessToken(config);
  const adAccountId = typeof config?.adAccountId === "string" ? config.adAccountId.trim() : "";
  if (!integration?.isActive || !accessToken || !adAccountId) {
    return { ok: false, error: "no_meta_auth", message: "A conta da Meta não está conectada nos Satélites desta empresa." };
  }
  const connectionCheck = config?.connectionCheck as { canUseAstro?: boolean; astroBlockedReason?: string | null } | undefined;
  if (connectionCheck?.canUseAstro === false) {
    return {
      ok: false,
      error: "mcp_unavailable",
      message: connectionCheck.astroBlockedReason ?? "O Astro ainda não pode gerenciar esta conta. Teste a conexão nos Satélites para ver o motivo.",
    };
  }
  return { ok: true, accessToken, adAccountId };
}

export function describeMetaMcpError(error: unknown): string {
  if (error instanceof MetaGraphError) {
    if (error.kind === "token_invalid") return "A conexão com a Meta venceu ou foi revogada. Reconecte em Satélites → Meta.";
    if (error.kind === "permission") {
      return "A Meta não deixou fazer isso com esta conexão (falta permissão ou o Astro ainda não foi liberado para esta conta).";
    }
    if (error.kind === "rate_limited") return error.userMessage;
    return error.message.replace(/^\[MetaAdsMCP\]\s*/, "").slice(0, 400);
  }
  return "Não foi possível falar com a Meta agora. Tente de novo em alguns minutos.";
}

/** Uma conexão por chamada: nada fica aberto entre os passos do chat. */
export async function withAdsMcp<T>(accessToken: string, run: (connection: AdsMcpConnection) => Promise<T>): Promise<T> {
  const connection = await connectAdsMcp(accessToken);
  try {
    return await run(connection);
  } finally {
    await connection.close();
  }
}

async function debitStars(params: { organizationId: string; userId: string; variant: string; feature: string }) {
  try {
    await meter({
      organizationId: params.organizationId,
      action: "meta_ads_action",
      variant: params.variant,
      userId: params.userId,
      appSlug: "meta-ads-mcp",
      description: `Astro Meta Ads — ${params.variant}`,
      feature: params.feature,
      cost: { kind: "OTHER", provider: "meta" },
    });
  } catch (error) {
    console.warn("[astro-meta-ads] cobrança de Stars falhou", params.variant, error);
  }
}

export async function debitMetaReadStars(organizationId: string, userId: string, toolName: string) {
  await debitStars({ organizationId, userId, variant: toolName, feature: "meta-ads.mcp" });
}

export async function debitMetaWriteStars(organizationId: string, userId: string, toolName: string) {
  await debitStars({ organizationId, userId, variant: toolName, feature: "meta-ads.execute" });
}

/** Lê nome, verba e fim de um objeto para o cartão de ativação (RF-5). */
async function readEntityForCard(
  access: OrgMetaMcpAccess,
  conversationId: string,
  entityType: string,
  entityId: string,
): Promise<{ name: string | null; budgetText: string | null }> {
  const level = entityType === "ad_set" ? "adset" : entityType === "ad" ? "ad" : "campaign";
  const fields = level === "ad" ? ["id", "name"] : ["id", "name", "daily_budget", "lifetime_budget", "stop_time"];
  try {
    const result = await withAdsMcp(access.accessToken, (connection) =>
      connection.callTool("ads_get_ad_entities", {
        ad_account_id: access.adAccountId.replace(/^act_/, ""),
        level,
        object_ids: [entityId],
        fields,
        client_conversation_id: conversationId,
      }),
    );
    const raw = (result as { ad_entities?: unknown } | null)?.ad_entities;
    const entities = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>[] | undefined;
    const entity = entities?.[0];
    if (!entity) return { name: null, budgetText: null };
    const money = (value: unknown) => {
      const amount = (value as { value?: string } | null)?.value ?? value;
      return amount ? `R$ ${String(amount)}` : null;
    };
    const daily = money(entity.daily_budget);
    const lifetime = money(entity.lifetime_budget);
    const stop = typeof entity.stop_time === "string" ? entity.stop_time.slice(0, 10).split("-").reverse().join("/") : null;
    const budgetText = [daily && `${daily} por dia`, lifetime && `${lifetime} no total`, stop && `até ${stop}`].filter(Boolean).join(", ");
    return { name: typeof entity.name === "string" ? entity.name : null, budgetText: budgetText || null };
  } catch {
    return { name: null, budgetText: null };
  }
}

export interface MetaMcpToolScope {
  /** trafeGO: só estes objetos podem ser lidos em detalhe ou alterados (RF-10). */
  allowedEntityIds?: string[];
  /** trafeGO: escrita limitada a pausar, retomar, verba e data de fim. */
  writeTools?: readonly MetaMcpWriteTool[];
}

/** Valida uma escrita e monta o texto do cartão (RF-4..RF-6). Não grava nem executa nada. */
export async function prepareMetaMcpWrite(params: {
  organizationId: string;
  userId: string;
  conversationId: string;
  toolName: MetaMcpWriteTool;
  args: Record<string, unknown>;
  scope?: MetaMcpToolScope;
}): Promise<{ ok: true; args: Record<string, unknown>; summary: string } | MetaMcpToolError> {
  const authorization = await checkMcpAuthorization(params.userId, params.organizationId);
  if (!authorization.authorized) return { ok: false, error: "unauthorized", message: unauthorizedMessage(authorization.reason) };
  const access = await resolveOrgMetaMcpAccess(params.organizationId);
  if (!access.ok) return access;

  if (params.scope?.writeTools && !params.scope.writeTools.includes(params.toolName)) {
    return { ok: false, error: "operation_not_allowed", message: "Esta ação não está disponível aqui." };
  }
  const entityId = typeof params.args.entity_id === "string" ? params.args.entity_id : null;
  if (params.scope?.allowedEntityIds && (!entityId || !params.scope.allowedEntityIds.includes(entityId))) {
    return { ok: false, error: "operation_not_allowed", message: "Só dá para mexer nas campanhas deste pedido." };
  }

  const injected = injectOrgAccount(params.args, access.adAccountId, params.conversationId);
  if (!injected.ok) return injected;

  const safety = await loadSafetyConfig(params.organizationId);
  const opError = checkOpAllowed(safety, resolveSafetyOp(params.toolName, injected.args));
  if (opError) return opError;
  const budgetError = checkBudgetCap({ toolName: params.toolName, args: injected.args, maxDailyReais: safety.maxBudgetPerCampaign });
  if (budgetError) return budgetError;
  const policyError = checkAdTextPolicy(params.toolName, injected.args);
  if (policyError) return policyError;

  let entityName: string | null = null;
  let activationBudget: string | null = null;
  if (entityId && typeof injected.args.entity_type === "string") {
    const entity = await readEntityForCard(access, params.conversationId, injected.args.entity_type, entityId);
    entityName = entity.name;
    activationBudget = entity.budgetText;
  }
  const baseSummary = buildWriteSummary(params.toolName, injected.args, entityName);
  const summary =
    params.toolName === "ads_activate_entity" && activationBudget ? `${baseSummary} Verba: ${activationBudget}.` : baseSummary;
  return { ok: true, args: injected.args, summary };
}

/** Propõe uma escrita no chat do Workspace/Insights: grava a pendência e devolve o cartão. */
export async function proposeMetaMcpWrite(params: Parameters<typeof prepareMetaMcpWrite>[0]) {
  const prepared = await prepareMetaMcpWrite(params);
  if (!prepared.ok) return prepared;
  const pending = await prisma.metaAdsPendingAction.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      toolName: params.toolName,
      payload: prepared.args as object,
      summary: prepared.summary,
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
    select: { id: true },
  });
  return { ok: true as const, requiresConfirmation: true, pendingActionId: pending.id, summary: prepared.summary, tool: params.toolName };
}

/** Executa uma escrita já confirmada, com a conta da org reinjetada. Stars só no sucesso (RF-7). */
export async function executeConfirmedMetaMcpWrite(params: {
  organizationId: string;
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
}): Promise<{ ok: true; result: unknown } | MetaMcpToolError> {
  if (!isMetaMcpWriteTool(params.toolName)) {
    return { ok: false, error: "operation_not_allowed", message: "Essa ação é de uma versão antiga do Astro. Peça de novo." };
  }
  const authorization = await checkMcpAuthorization(params.userId, params.organizationId);
  if (!authorization.authorized) return { ok: false, error: "unauthorized", message: unauthorizedMessage(authorization.reason) };
  const access = await resolveOrgMetaMcpAccess(params.organizationId);
  if (!access.ok) return access;
  const injected = injectOrgAccount(params.args, access.adAccountId, String(params.args.client_conversation_id ?? "astroMetaAds00000000"));
  if (!injected.ok) return injected;
  try {
    const result = await withAdsMcp(access.accessToken, (connection) => connection.callTool(params.toolName, injected.args));
    await debitMetaWriteStars(params.organizationId, params.userId, params.toolName);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: "meta_error", message: describeMetaMcpError(error) };
  }
}

/** Executa uma leitura da lista aprovada, já com a conta da org injetada. */
export async function runMetaMcpRead(params: {
  organizationId: string;
  userId: string;
  conversationId: string;
  toolName: string;
  args: Record<string, unknown>;
  scope?: MetaMcpToolScope;
}) {
  if (!isMetaMcpReadTool(params.toolName)) {
    return { ok: false as const, error: "operation_not_allowed", message: "Esta consulta não está liberada para o Astro." };
  }
  const authorization = await checkMcpAuthorization(params.userId, params.organizationId);
  if (!authorization.authorized) return { ok: false as const, error: "unauthorized", message: unauthorizedMessage(authorization.reason) };
  const access = await resolveOrgMetaMcpAccess(params.organizationId);
  if (!access.ok) return access;

  const scopedArgs = params.scope?.allowedEntityIds
    ? { ...params.args, object_ids: (Array.isArray(params.args.object_ids) ? (params.args.object_ids as string[]) : params.scope.allowedEntityIds).filter((id) => params.scope?.allowedEntityIds?.includes(id)) }
    : params.args;
  if (params.scope?.allowedEntityIds && (scopedArgs as { object_ids: string[] }).object_ids.length === 0) {
    return { ok: false as const, error: "operation_not_allowed", message: "Este pedido ainda não tem campanha na conta." };
  }

  const injected = injectOrgAccount(scopedArgs, access.adAccountId, params.conversationId);
  if (!injected.ok) return injected;
  try {
    const result = await withAdsMcp(access.accessToken, (connection) => connection.callTool(params.toolName, injected.args));
    await debitMetaReadStars(params.organizationId, params.userId, params.toolName);
    return { ok: true as const, result: truncateForModel(result) };
  } catch (error) {
    return { ok: false as const, error: "meta_error", message: describeMetaMcpError(error) };
  }
}

function toAstroToolName(mcpToolName: string): string {
  return `meta_${mcpToolName}`;
}

/**
 * Ferramentas do MCP oficial, filtradas pela lista aprovada, como ferramentas do Astro.
 * Uma consulta `tools/list` por conversa; a ferramenta que a Meta tirou some (CB-5).
 */
export async function buildMetaMcpAstroTools(params: {
  organizationId: string;
  userId: string;
  conversationId: string;
  scope?: MetaMcpToolScope & { readTools?: readonly string[] };
}): Promise<Record<string, Tool>> {
  const access = await resolveOrgMetaMcpAccess(params.organizationId);
  if (!access.ok) return {};

  let mcpTools: AdsMcpToolInfo[];
  try {
    mcpTools = await withAdsMcp(access.accessToken, (connection) => connection.listTools());
  } catch (error) {
    console.warn("[astro-meta-ads] tools/list falhou", error);
    return {};
  }

  const tools: Record<string, Tool> = {};
  for (const mcpTool of mcpTools) {
    const isRead = isMetaMcpReadTool(mcpTool.name) && (!params.scope?.readTools || params.scope.readTools.includes(mcpTool.name));
    const isWrite = isMetaMcpWriteTool(mcpTool.name) && (!params.scope?.writeTools || params.scope.writeTools.includes(mcpTool.name));
    if (!isRead && !isWrite) continue;

    const description = `${isWrite ? "[ESCRITA: só PROPÕE; o usuário confirma no cartão. Nunca diga que já foi feito.] " : ""}${mcpTool.description}`.slice(0, MAX_DESCRIPTION_CHARS);
    tools[toAstroToolName(mcpTool.name)] = tool({
      description,
      inputSchema: jsonSchema<Record<string, unknown>>(stripServerFilledArgs(mcpTool.inputSchema)),
      execute: async (args: Record<string, unknown>) =>
        isWrite
          ? proposeMetaMcpWrite({ ...params, toolName: mcpTool.name as MetaMcpWriteTool, args })
          : runMetaMcpRead({ ...params, toolName: mcpTool.name, args }),
    });
  }
  return tools;
}
