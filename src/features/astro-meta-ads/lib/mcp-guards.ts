import { prescreenAdContent } from "@/features/trafego/lib/ad-policies";

/**
 * Regras puras do Astro com o MCP oficial da Meta (spec 0125, RF-2, RF-3, RF-5, RF-6).
 * Sem rede: o script de QA testa direto.
 */

/** Leitura: roda direto quando o modelo chama. */
export const META_MCP_READ_TOOLS = [
  "ads_get_ad_entities",
  "ads_get_ad_account_pages",
  "ads_get_ig_accounts",
  "ads_get_ig_media",
  "ads_get_creatives",
  "ads_get_creative_ads",
  "ads_get_ad_preview",
  "ads_get_field_context",
  "ads_get_errors",
  "ads_get_opportunity_score",
  "ads_insights_performance_trend",
  "ads_insights_anomaly_signal",
  "ads_insights_industry_benchmark",
] as const;

/** Escrita: vira proposta com cartão; só o clique em "Confirmar" executa. */
export const META_MCP_WRITE_TOOLS = [
  "ads_update_entity",
  "ads_create_campaign",
  "ads_create_ad_set",
  "ads_create_creative",
  "ads_create_ad",
  "ads_boost_ig_post",
  "ads_activate_entity",
] as const;

export type MetaMcpReadTool = (typeof META_MCP_READ_TOOLS)[number];
export type MetaMcpWriteTool = (typeof META_MCP_WRITE_TOOLS)[number];

export function isMetaMcpReadTool(name: string): name is MetaMcpReadTool {
  return (META_MCP_READ_TOOLS as readonly string[]).includes(name);
}

export function isMetaMcpWriteTool(name: string): name is MetaMcpWriteTool {
  return (META_MCP_WRITE_TOOLS as readonly string[]).includes(name);
}

/** Campos que o servidor preenche: o modelo nunca vê nem escolhe (D-3). */
export const SERVER_FILLED_ARGS = ["ad_account_id", "client_conversation_id", "client_model", "hide_ui"] as const;

export function toNumericAccountId(adAccountId: string): string {
  return adAccountId.replace(/^act_/, "");
}

export type GuardError = { ok: false; error: "operation_not_allowed" | "budget_exceeded" | "wrong_account" | "policy_blocked" | "policy_warning"; message: string };

/** Injeta a conta da org; qualquer outra conta pedida pelo modelo é recusada (CA-3). */
export function injectOrgAccount(
  args: Record<string, unknown>,
  orgAdAccountId: string,
  conversationId: string,
): { ok: true; args: Record<string, unknown> } | GuardError {
  const orgAccount = toNumericAccountId(orgAdAccountId);
  const requested = args.ad_account_id;
  if (typeof requested === "string" && requested.trim() && toNumericAccountId(requested.trim()) !== orgAccount) {
    return { ok: false, error: "wrong_account", message: "Só dá para mexer na conta de anúncios conectada nos Satélites desta empresa." };
  }
  const cleanArgs = Object.fromEntries(Object.entries(args).filter(([key]) => !(SERVER_FILLED_ARGS as readonly string[]).includes(key)));
  return { ok: true, args: { ...cleanArgs, ad_account_id: orgAccount, client_conversation_id: conversationId, hide_ui: true } };
}

/** Esquema mostrado ao modelo, sem os campos que o servidor preenche. */
export function stripServerFilledArgs(inputSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = { ...((inputSchema.properties as Record<string, unknown> | undefined) ?? {}) };
  for (const key of SERVER_FILLED_ARGS) delete properties[key];
  const required = Array.isArray(inputSchema.required)
    ? (inputSchema.required as string[]).filter((key) => !(SERVER_FILLED_ARGS as readonly string[]).includes(key))
    : undefined;
  return { ...inputSchema, type: "object", properties, ...(required ? { required } : {}) };
}

function parseFields(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export type SafetyOp = "read" | "pause" | "resume" | "create" | "update" | "delete" | "catalog";

/** Operação da trava da org para cada escrita. */
export function resolveSafetyOp(toolName: MetaMcpWriteTool, args: Record<string, unknown>): SafetyOp {
  if (toolName === "ads_activate_entity") return "resume";
  if (toolName === "ads_update_entity") {
    const fields = parseFields(args.fields);
    const keys = Object.keys(fields);
    if (keys.length === 1 && fields.status === "PAUSED") return "pause";
    if (fields.status === "DELETED") return "delete";
    return "update";
  }
  return "create";
}

/** Verbas em centavos citadas numa escrita (diária e total, campanha ou conjunto). */
export function extractBudgetsCents(toolName: MetaMcpWriteTool, args: Record<string, unknown>): { dailyCents: number[]; lifetimeCents: number[] } {
  const source = toolName === "ads_update_entity" ? parseFields(args.fields) : args;
  const pick = (keys: string[]) =>
    keys.map((key) => Number(source[key])).filter((value) => Number.isFinite(value) && value > 0);
  return {
    dailyCents: pick(["campaign_daily_budget", "daily_budget"]),
    lifetimeCents: pick(["campaign_lifetime_budget", "lifetime_budget", "campaign_spend_cap", "spend_cap"]),
  };
}

/**
 * Teto da org (`mcpMaxBudgetPerCampaign`, em reais por dia). Verba total é comparada
 * pelo equivalente diário quando há data de fim; sem data, conta o total inteiro.
 */
export function checkBudgetCap(params: {
  toolName: MetaMcpWriteTool;
  args: Record<string, unknown>;
  maxDailyReais: number;
  days?: number | null;
}): GuardError | null {
  const { dailyCents, lifetimeCents } = extractBudgetsCents(params.toolName, params.args);
  const capCents = Math.round(params.maxDailyReais * 100);
  const dailyEquivalents = [
    ...dailyCents,
    ...lifetimeCents.map((cents) => (params.days && params.days > 0 ? Math.ceil(cents / params.days) : cents)),
  ];
  const over = dailyEquivalents.find((cents) => cents > capCents);
  if (over === undefined) return null;
  return {
    ok: false,
    error: "budget_exceeded",
    message: `A verba pedida passa do limite desta empresa (R$ ${params.maxDailyReais.toFixed(2)} por dia). Quem administra pode mudar em Satélites → Meta → Astro + IA.`,
  };
}

const AD_TEXT_KEYS = ["message", "primary_text", "body", "headline", "title", "description", "caption", "link_description"];

function collectAdTexts(value: unknown, texts: string[], depth = 0): void {
  if (depth > 6 || value === null || value === undefined) return;
  if (typeof value === "string") {
    const parsed = value.trim().startsWith("{") || value.trim().startsWith("[") ? parseFields(value) : null;
    if (parsed && Object.keys(parsed).length > 0) collectAdTexts(parsed, texts, depth + 1);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAdTexts(item, texts, depth + 1));
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (AD_TEXT_KEYS.includes(key) && typeof item === "string") texts.push(item);
      else collectAdTexts(item, texts, depth + 1);
    }
  }
}

/** Política de texto (inclusive atributos pessoais) antes de ir à Meta (CA-10). */
export function checkAdTextPolicy(toolName: MetaMcpWriteTool, args: Record<string, unknown>): GuardError | null {
  if (toolName !== "ads_create_creative" && toolName !== "ads_create_ad" && toolName !== "ads_boost_ig_post") return null;
  const texts: string[] = [];
  collectAdTexts(args, texts);
  const prescreen = prescreenAdContent({ platform: "META_ADS", texts });
  const blocked = prescreen.hits.find((hit) => hit.level === "BLOCKED");
  if (blocked) return { ok: false, error: "policy_blocked", message: `${blocked.label}: ${blocked.reason} ${blocked.fix}` };
  return null;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ENTITY_LABEL: Record<string, string> = { campaign: "campanha", ad_set: "conjunto", ad: "anúncio" };

/** Texto do cartão de confirmação, em português, a partir dos argumentos reais (RF-4). */
export function buildWriteSummary(toolName: MetaMcpWriteTool, args: Record<string, unknown>, entityName?: string | null): string {
  const target = entityName ? `"${entityName}"` : String(args.entity_id ?? "");
  const entityLabel = ENTITY_LABEL[String(args.entity_type ?? "")] ?? "item";
  const { dailyCents, lifetimeCents } = extractBudgetsCents(toolName, args);
  const budgetText = [
    ...dailyCents.map((cents) => `${formatCents(cents)} por dia`),
    ...lifetimeCents.map((cents) => `${formatCents(cents)} no total`),
  ].join(", ");

  switch (toolName) {
    case "ads_activate_entity":
      return `Ativar ${entityLabel} ${target}. A partir daqui a Meta começa a gastar a verba.`;
    case "ads_update_entity": {
      const fields = parseFields(args.fields);
      if (Object.keys(fields).length === 1 && fields.status === "PAUSED") return `Pausar ${entityLabel} ${target}.`;
      const parts: string[] = [];
      if (typeof fields.name === "string") parts.push(`nome para "${fields.name}"`);
      if (budgetText) parts.push(`verba ${budgetText}`);
      if (typeof fields.stop_time === "string" || typeof fields.end_time === "string") {
        parts.push(`fim em ${String(fields.stop_time ?? fields.end_time).slice(0, 10).split("-").reverse().join("/")}`);
      }
      if (fields.targeting) parts.push("público (a Meta revisa de novo)");
      if (typeof fields.status === "string" && fields.status !== "PAUSED") parts.push(`status ${fields.status}`);
      return `Alterar ${entityLabel} ${target}: ${parts.join(", ") || "campos pedidos"}.`;
    }
    case "ads_create_campaign":
      return `Criar campanha "${String(args.campaign_name ?? "")}" (${String(args.objective ?? "")})${budgetText ? `, verba ${budgetText}` : ""}. Nasce pausada.`;
    case "ads_create_ad_set":
      return `Criar conjunto "${String(args.ad_set_name ?? args.name ?? "")}" na campanha ${String(args.campaign_id ?? "")}${budgetText ? `, verba ${budgetText}` : ""}. Nasce pausado.`;
    case "ads_create_creative":
      return `Criar criativo "${String(args.creative_name ?? args.name ?? "")}".`;
    case "ads_create_ad":
      return `Criar anúncio "${String(args.ad_name ?? args.name ?? "")}" no conjunto ${String(args.adset_id ?? args.ad_set_id ?? "")}. Nasce pausado.`;
    case "ads_boost_ig_post":
      return `Impulsionar o post do Instagram${budgetText ? ` com verba ${budgetText}` : ""}. Nasce pausado.`;
  }
}

/** Resposta de ferramenta truncada antes de ir ao modelo (RNF-4). */
export function truncateForModel(value: unknown, maxChars = 12_000): unknown {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text || text.length <= maxChars) return value;
  return { truncated: true, preview: text.slice(0, maxChars), note: "Resposta grande cortada. Peça um filtro mais específico." };
}
