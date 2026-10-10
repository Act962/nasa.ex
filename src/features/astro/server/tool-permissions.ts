import "server-only";
import type { ToolSet } from "ai";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AppKey, OrgAction } from "@/features/permissions/lib/catalog";
import { canAstroDo } from "@/features/astro/actions/permission-gate";
import { ASTRO_ACTIONS } from "@/features/astro/actions/registry";
import { APP_TOOL_PACKS } from "@/features/astro/server/tools/app-packs";

/**
 * Permissão de cada ferramenta entregue à IA (spec 0082).
 *
 * A IA só recebe a ferramenta do App que a pessoa pode usar: sem a ferramenta
 * não há como convencê-la a trazer o dado. Ferramenta que não está declarada
 * aqui não é entregue — negar é o padrão.
 */

type ToolPermission = { appKey: AppKey; action: OrgAction };

/** Não lê nem altera dado de App: ajuda, guia na tela, confirmação pendente. */
const OPEN = "open";
/** Cruza Apps e filtra por dentro, a cada chamada. */
const SELF_GATED = "self-gated";

type ToolRule = ToolPermission | typeof OPEN | typeof SELF_GATED;

function rulesFor(appKey: AppKey, action: OrgAction, toolNames: string[]): Record<string, ToolRule> {
  return Object.fromEntries(toolNames.map((toolName) => [toolName, { appKey, action }]));
}

const STATIC_RULES: Record<string, ToolRule> = {
  ...rulesFor("tracking", "view", [
    "get_tracking_overview",
    "list_leads",
    "list_trackings",
    "chart_leads_monthly_growth",
    "search_lead",
    "list_taggable_tags",
  ]),
  ...rulesFor("tracking", "create", ["create_lead", "create_tag", "create_tracking"]),
  ...rulesFor("tracking", "edit", ["update_lead", "move_lead", "propose_tags_for_lead", "update_lead_tags"]),
  ...rulesFor("tracking-automacoes", "view", ["list_workflow_presets", "list_alert_rules", "list_alert_events"]),
  ...rulesFor("tracking-automacoes", "create", [
    "apply_workflow_preset",
    "generate_workflow_from_intent",
    "create_alert_rule",
  ]),
  ...rulesFor("tracking-automacoes", "edit", ["toggle_alert_rule"]),
  ...rulesFor("insights", "view", [
    "get_funnel",
    "get_leads_by_channel",
    "get_leads_by_tags",
    "get_sold_this_month",
    "get_won_lost_leads",
    "get_insights_reports",
    "get_org_activity_summary",
    "get_platform_status_metrics",
    "chart_revenue_by_month",
  ]),
  ...rulesFor("spacetime", "view", [
    "get_agenda_metrics",
    "list_agendas",
    "list_appointments",
    "list_appointment_creators",
    "chart_appointment_creators",
    "chart_appointments_by_status",
  ]),
  ...rulesFor("spacetime", "create", ["create_agenda", "create_appointment"]),
  ...rulesFor("chat", "view", ["get_chat_metrics", "list_conversations", "get_conversation"]),
  ...rulesFor("chat", "create", ["send_whatsapp_message", "send_whatsapp_to_number"]),
  ...rulesFor("forge", "view", ["get_forge_metrics", "list_proposals", "chart_forge_proposals_by_status"]),
  ...rulesFor("forge-contracts", "view", ["list_contracts"]),
  ...rulesFor("formularios", "view", ["get_forms_metrics"]),
  ...rulesFor("linnker", "view", ["get_linnker_metrics"]),
  ...rulesFor("nbox", "view", ["get_nbox_metrics"]),
  ...rulesFor("nasa-route", "view", ["get_route_metrics"]),
  ...rulesFor("workspace", "view", ["get_workspace_metrics", "list_actions", "list_workspaces"]),
  ...rulesFor("workspace", "create", ["create_action", "create_workspace"]),
  search_entities: SELF_GATED,
  get_space_help_catalog: OPEN,
  get_space_help_features: OPEN,
  search_knowledge: OPEN,
  start_guide: OPEN,
  // Só confirmam ou cancelam o que a pessoa já pôde propor; a gravação
  // confere a permissão de novo (`confirmation.ts`).
  confirm_action: OPEN,
  cancel_action: OPEN,
  list_pending_actions: OPEN,
};

/** App de cada pacote: leitura pede "ver"; escrita pede a ação indicada. */
const PACK_PERMISSIONS: Record<string, { appKey: AppKey; writeAction: OrgAction }> = {
  payment: { appKey: "financeiro", writeAction: "create" },
  accounting: { appKey: "financeiro", writeAction: "create" },
  "whatsapp-setup": { appKey: "integrations", writeAction: "edit" },
  planner: { appKey: "nasa-planner", writeAction: "create" },
};

// Os construtores só fecham sobre o contexto; nada é lido até o `execute`.
const NAMES_ONLY_CONTEXT: AgentContext = { userId: "", organizationId: "", route: {} };

let cachedRules: Map<string, ToolRule> | null = null;

function loadRules(): Map<string, ToolRule> {
  if (cachedRules) return cachedRules;
  const rules = new Map<string, ToolRule>();
  for (const action of ASTRO_ACTIONS) rules.set(action.toolName, action.permission);
  for (const [packKey, pack] of Object.entries(APP_TOOL_PACKS)) {
    const packPermission = PACK_PERMISSIONS[packKey];
    if (!packPermission) continue;
    for (const toolName of Object.keys(pack.read(NAMES_ONLY_CONTEXT))) {
      rules.set(toolName, { appKey: packPermission.appKey, action: "view" });
    }
    for (const toolName of Object.keys(pack.write(NAMES_ONLY_CONTEXT))) {
      rules.set(toolName, { appKey: packPermission.appKey, action: packPermission.writeAction });
    }
  }
  for (const [toolName, rule] of Object.entries(STATIC_RULES)) rules.set(toolName, rule);
  cachedRules = rules;
  return rules;
}

/** `route_to_*` só delega; as ferramentas do sub-agente passam por este mesmo filtro. */
const ROUTING_TOOL = /^route_to_/;

export function toolRuleFor(toolName: string): ToolRule | null {
  if (ROUTING_TOOL.test(toolName)) return OPEN;
  return loadRules().get(toolName) ?? null;
}

export async function filterToolsByPermission(tools: ToolSet, ctx: AgentContext): Promise<ToolSet> {
  const allowedTools: ToolSet = {};
  for (const [toolName, definition] of Object.entries(tools)) {
    const rule = toolRuleFor(toolName);
    if (!rule) {
      console.warn(`[ASTRO/permission] ferramenta sem permissão declarada, não entregue: ${toolName}`);
      continue;
    }
    if (rule === OPEN || rule === SELF_GATED || (await canAstroDo(ctx, rule.appKey, rule.action))) {
      allowedTools[toolName] = definition;
    }
  }
  return allowedTools;
}
