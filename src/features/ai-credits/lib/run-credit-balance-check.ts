import "server-only";

import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import { resolveOrgAdmins } from "@/features/alerts/lib/audience-resolver";
import { computeAiCreditsOverview, type AiCreditScope } from "./compute-ai-credits";
import { AI_CREDIT_PROVIDER_LABELS, type AiCreditProviderSummary } from "./ai-credit-types";

/** Aviso antes do crédito de IA acabar, por escopo e provedor (spec 0055, RF-5). */

export const AI_CREDIT_LOW_EVENT = "ai.credit_low";
const PLATFORM_SCOPE_KEY = "platform";

function startOfBusinessDay(): Date {
  const dayKey = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${dayKey}T03:00:00.000Z`);
}

async function resolveRecipients(scope: AiCreditScope): Promise<string[]> {
  if (scope.organizationId) return resolveOrgAdmins(scope.organizationId);
  const systemAdmins = await prisma.user.findMany({ where: { isSystemAdmin: true, isActive: true }, select: { id: true } });
  return systemAdmins.map((user) => user.id);
}

async function wasAlertedToday(scopeKey: string, summary: AiCreditProviderSummary): Promise<boolean> {
  const existing = await prisma.adminNotification.findFirst({
    where: {
      eventType: AI_CREDIT_LOW_EVENT,
      createdAt: { gte: startOfBusinessDay() },
      AND: [
        { eventPayload: { path: ["scope"], equals: scopeKey } },
        { eventPayload: { path: ["provider"], equals: summary.provider } },
        { eventPayload: { path: ["level"], equals: summary.level } },
      ],
    },
    select: { id: true },
  });
  return existing !== null;
}

function describeSummary(summary: AiCreditProviderSummary): string {
  const balanceText = `US$ ${(summary.balanceUsd ?? 0).toFixed(2)}`;
  const percentText = summary.remainingPercent !== null ? ` (${Math.round(summary.remainingPercent)}% do último saldo)` : "";
  const daysText = summary.daysLeft !== null ? ` No ritmo atual, acaba em ${Math.max(0, Math.floor(summary.daysLeft))} dia(s).` : "";
  return `Saldo estimado: ${balanceText}${percentText}.${daysText}`;
}

async function alertScope(scope: AiCreditScope): Promise<number> {
  const overview = await computeAiCreditsOverview(scope);
  const scopeKey = scope.organizationId ?? PLATFORM_SCOPE_KEY;
  let dispatched = 0;
  for (const summary of overview.providers) {
    if (summary.level !== "warning" && summary.level !== "critical") continue;
    if (await wasAlertedToday(scopeKey, summary)) continue;
    const userIds = await resolveRecipients(scope);
    if (userIds.length === 0) continue;
    const providerLabel = AI_CREDIT_PROVIDER_LABELS[summary.provider];
    const isCritical = summary.level === "critical";
    const result = await dispatchAlert(
      AI_CREDIT_LOW_EVENT,
      { scope: scopeKey, provider: summary.provider, level: summary.level, balanceUsd: summary.balanceUsd, orgId: scope.organizationId },
      {
        bypassRules: {
          title: isCritical ? `Crédito da ${providerLabel} quase no fim` : `Crédito da ${providerLabel} baixando`,
          body: scope.organizationId
            ? `${describeSummary(summary)} Recarregue a conta do provedor e informe o novo saldo em Satélites para o ASTRO seguir na sua IA.`
            : `${describeSummary(summary)} Recarregue a conta da plataforma e registre em Admin → Créditos de IA.`,
          severity: isCritical ? "critical" : "warning",
          audience: { kind: "user", userIds },
          orgId: scope.organizationId,
          createdBy: "SYSTEM",
          actionUrl: scope.organizationId ? "/integrations" : "/admin/ai-credits",
        },
      },
    );
    dispatched += result.dispatchedCount;
  }
  return dispatched;
}

/** Varredura de hora em hora: plataforma e cada empresa que informou saldo da própria chave. */
export async function runAiCreditBalanceCheck(): Promise<{ scopesChecked: number; dispatched: number }> {
  let organizationScopes: AiCreditScope[] = [];
  try {
    const organizationsWithEntries = await prisma.aiCreditEntry.findMany({
      where: { organizationId: { not: null } },
      distinct: ["organizationId"],
      select: { organizationId: true },
    });
    organizationScopes = organizationsWithEntries.map((entry) => ({ organizationId: entry.organizationId }));
  } catch (loadError) {
    // Migração ainda não aplicada: sem lançamentos, não há saldo para avisar (RNF-2).
    console.warn("[ai-credits] varredura sem lançamentos:", loadError);
    return { scopesChecked: 0, dispatched: 0 };
  }

  let dispatched = 0;
  for (const scope of [{ organizationId: null }, ...organizationScopes]) {
    try {
      dispatched += await alertScope(scope);
    } catch (scopeError) {
      console.warn("[ai-credits] aviso de saldo falhou:", scope.organizationId ?? PLATFORM_SCOPE_KEY, scopeError);
    }
  }
  return { scopesChecked: organizationScopes.length + 1, dispatched };
}
