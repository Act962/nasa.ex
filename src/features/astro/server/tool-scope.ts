import "server-only";
import type { ToolSet } from "ai";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { buildAnalyticsTools } from "@/features/astro/server/tools/analytics";
import { buildListTools } from "@/features/astro/server/tools/lists";
import { buildActionTools } from "@/features/astro/server/tools/actions";
import { buildMutationTools } from "@/features/astro/server/tools/mutations";
import { buildSearchTools } from "@/features/astro/server/tools/search";
import { buildChartTools } from "@/features/astro/server/tools/charts";
import { buildInsightsReportTools } from "@/features/astro/server/tools/insights-reports";
import { buildWorkflowTools } from "@/features/astro/server/tools/workflows";
import { buildProposalTools } from "@/features/astro/server/tools/_shared/proposals/confirm-tools";
import { listAppToolPacks } from "@/features/astro/server/tools/app-packs";
import { buildTrafegoAstroTools } from "@/features/trafego/server/lib/astro-tools";

/**
 * Escopos de tools do orquestrador (spec 0014, D-1):
 *   - "full":      in-app — leitura + mutação + workflows + packs de app (read+write).
 *   - "insights":  WhatsApp sem financeiro — só leitura da plataforma (inalterado).
 *   - "assistant": WhatsApp com financeiro habilitado — leitura da plataforma +
 *                  packs de app (read+write) + confirmação. Sem routing pra
 *                  sub-agents (continuam fora do WhatsApp).
 *   - "trafego":   painel do cliente trafeGO — só as tools do pedido.
 */
export type AstroToolScope = "full" | "insights" | "assistant" | "trafego";

export interface ResolvedToolScope {
  tools: ToolSet;
  /** Blocos de prompt dos packs ativos, concatenados. */
  packPrompts: string;
  /** Se o orquestrador deve expor `route_to_*` pros sub-agents. */
  allowsRouting: boolean;
}

function buildPlatformReadTools(ctx: AgentContext): ToolSet {
  return {
    ...buildAnalyticsTools(ctx),
    ...buildListTools(ctx),
    ...buildSearchTools(ctx),
    ...buildChartTools(ctx),
    ...buildInsightsReportTools(ctx),
  };
}

function buildAppPackTools(ctx: AgentContext, includeWrites: boolean) {
  let tools: ToolSet = {};
  const prompts: string[] = [];
  for (const pack of listAppToolPacks()) {
    tools = { ...tools, ...pack.read(ctx) };
    if (includeWrites) tools = { ...tools, ...pack.write(ctx) };
    prompts.push(pack.systemPrompt);
  }
  if (includeWrites) tools = { ...tools, ...buildProposalTools(ctx) };
  return { tools, prompts };
}

export function resolveToolSetForScope(scope: AstroToolScope, ctx: AgentContext): ResolvedToolScope {
  if (scope === "trafego") {
    return { tools: buildTrafegoAstroTools(ctx), packPrompts: "", allowsRouting: false };
  }

  if (scope === "insights") {
    return { tools: buildPlatformReadTools(ctx), packPrompts: "", allowsRouting: false };
  }

  const packs = buildAppPackTools(ctx, true);
  const packPrompts = packs.prompts.join("\n");

  if (scope === "assistant") {
    return {
      tools: { ...buildPlatformReadTools(ctx), ...packs.tools },
      packPrompts,
      allowsRouting: false,
    };
  }

  return {
    tools: {
      ...buildPlatformReadTools(ctx),
      ...buildActionTools(ctx),
      ...buildMutationTools(ctx),
      ...buildWorkflowTools(ctx),
      ...packs.tools,
    },
    packPrompts,
    allowsRouting: true,
  };
}
