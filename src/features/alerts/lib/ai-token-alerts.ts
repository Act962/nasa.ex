// Crédito de IA esgotado e consumo alto de tokens (spec 0037).

import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import { resolveOrgAdmins } from "@/features/alerts/lib/audience-resolver";

export const AI_QUOTA_EXHAUSTED_EVENT = "ai.quota_exhausted";
export const AI_TOKEN_USAGE_HIGH_EVENT = "ai.token_usage_high";

const QUOTA_ALERT_COOLDOWN_MS = 24 * 60 * 60_000;
const DEFAULT_DAILY_TOKEN_LIMIT = 1_000_000;
const BUSINESS_TIMEZONE = "America/Sao_Paulo";

const QUOTA_ERROR_PATTERN =
  /insufficient_quota|exceeded your current quota|credit_balance_too_low|credit_balance_exhausted|resource_exhausted/i;

export function dailyTokenLimit(): number {
  const configured = Number(process.env.AI_TOKEN_DAILY_ALERT_TOKENS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DAILY_TOKEN_LIMIT;
}

function describeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";
  const candidate = error as { message?: unknown; code?: unknown; type?: unknown; error?: unknown; cause?: unknown; responseBody?: unknown };
  return [candidate.message, candidate.code, candidate.type, candidate.responseBody]
    .filter((part): part is string => typeof part === "string")
    .concat(candidate.error ? describeError(candidate.error) : [])
    .concat(candidate.cause ? describeError(candidate.cause) : [])
    .join(" ");
}

/** A recusa veio por falta de crédito no provedor (e não limite de taxa ou chave inválida)? */
export function isAiQuotaError(error: unknown): boolean {
  return QUOTA_ERROR_PATTERN.test(describeError(error));
}

/** Chave própria → admins da org; chave da plataforma → administradores do sistema (RF-2). */
async function resolveRecipients(organizationId: string, usingCustomKey: boolean): Promise<string[]> {
  if (usingCustomKey) return resolveOrgAdmins(organizationId);
  const systemAdmins = await prisma.user.findMany({ where: { isSystemAdmin: true, isActive: true }, select: { id: true } });
  return systemAdmins.map((user) => user.id);
}

async function wasAlertedSince(organizationId: string, eventType: string, usingCustomKey: boolean, since: Date) {
  const existing = await prisma.adminNotification.findFirst({
    where: {
      organizationId,
      eventType,
      createdAt: { gte: since },
      eventPayload: { path: ["usingCustomKey"], equals: usingCustomKey },
    },
    select: { id: true },
  });
  return existing !== null;
}

async function dispatchAiAlert(params: {
  organizationId: string;
  usingCustomKey: boolean;
  eventType: string;
  severity: "critical" | "warning";
  title: string;
  body: string;
  payload: Record<string, unknown>;
}): Promise<number> {
  const userIds = await resolveRecipients(params.organizationId, params.usingCustomKey);
  if (userIds.length === 0) return 0;
  const result = await dispatchAlert(
    params.eventType,
    { ...params.payload, usingCustomKey: params.usingCustomKey, orgId: params.organizationId },
    {
      bypassRules: {
        title: params.title,
        body: params.body,
        severity: params.severity,
        audience: { kind: "user", userIds },
        orgId: params.organizationId,
        createdBy: "SYSTEM",
        actionUrl: null,
      },
    },
  );
  return result.dispatchedCount;
}

/**
 * Chamado onde a IA falhou. Best-effort: nunca lança (RNF-2) e alerta no
 * máximo uma vez a cada 24 h por org e tipo de chave (RNF-1).
 */
export async function reportAiQuotaExhausted(params: {
  organizationId: string;
  usingCustomKey: boolean;
  source: string;
  error?: unknown;
}): Promise<void> {
  try {
    if (params.error !== undefined && !isAiQuotaError(params.error)) return;
    const since = new Date(Date.now() - QUOTA_ALERT_COOLDOWN_MS);
    if (await wasAlertedSince(params.organizationId, AI_QUOTA_EXHAUSTED_EVENT, params.usingCustomKey, since)) return;
    await dispatchAiAlert({
      organizationId: params.organizationId,
      usingCustomKey: params.usingCustomKey,
      eventType: AI_QUOTA_EXHAUSTED_EVENT,
      severity: "critical",
      title: "Crédito da IA acabou",
      body: params.usingCustomKey
        ? "A chave de IA própria desta empresa ficou sem crédito no provedor. Recarregue a conta do provedor para a IA voltar a responder."
        : "A conta de IA da plataforma ficou sem crédito no provedor. Recarregue para o ASTRO, a IA do WhatsApp e os Workflows voltarem a responder.",
      payload: { source: params.source },
    });
  } catch (alertError) {
    console.warn("[ai-token-alerts] alerta de crédito falhou:", alertError);
  }
}

function todayStartInBusinessTimezone(): Date {
  const dayKey = new Date().toLocaleDateString("en-CA", { timeZone: BUSINESS_TIMEZONE });
  // São Paulo é UTC-3 o ano todo (sem horário de verão desde 2019).
  return new Date(`${dayKey}T03:00:00.000Z`);
}

interface DailyUsageRow {
  organization_id: string;
  using_custom_key: boolean;
  tokens: bigint;
}

/** Varredura de hora em hora (RF-4). `organizationId` restringe a uma org (bateria de QA). */
export async function runAiTokenUsageDetection(scope: { organizationId?: string } = {}) {
  const dayStart = todayStartInBusinessTimezone();
  const limit = dailyTokenLimit();
  const rows = await prisma.$queryRaw<DailyUsageRow[]>`
    select organization_id, using_custom_key, sum(coalesce(total_tokens, 0))::bigint as tokens
    from usage_event
    where kind = 'LLM' and created_at >= ${dayStart}
      and (${scope.organizationId ?? null}::text is null or organization_id = ${scope.organizationId ?? null})
    group by organization_id, using_custom_key
    having sum(coalesce(total_tokens, 0)) >= ${limit}`;

  let dispatched = 0;
  for (const row of rows) {
    if (await wasAlertedSince(row.organization_id, AI_TOKEN_USAGE_HIGH_EVENT, row.using_custom_key, dayStart)) continue;
    const tokens = Number(row.tokens);
    dispatched += await dispatchAiAlert({
      organizationId: row.organization_id,
      usingCustomKey: row.using_custom_key,
      eventType: AI_TOKEN_USAGE_HIGH_EVENT,
      severity: "warning",
      title: "Consumo alto de tokens de IA",
      body: `A IA já usou ${tokens.toLocaleString("pt-BR")} tokens hoje (limite de aviso: ${limit.toLocaleString("pt-BR")}).`,
      payload: { tokens, limit },
    });
  }
  return { orgsOverLimit: rows.length, dispatched };
}
