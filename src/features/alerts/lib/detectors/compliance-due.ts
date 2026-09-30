/**
 * Cron: detect-compliance-due (spec 0051, RF-16)
 *
 * Todo dia às 08:00 (São Paulo), para cada org com o perfil fiscal concluído:
 * prazos fiscais (5/2/0 dias e até 3 dias de atraso), apuração não confirmada
 * no dia 10, despesas sem nota (segunda), documentos vencendo/vencidos e
 * queda do score. Cada aviso vai para o sino, para o WhatsApp dos telefones do
 * perfil e para o gatilho de automação COMPLIANCE_ITEM_DUE.
 *
 * Idempotência (CA-28): `AlertDispatch` exige uma AlertRule, e aqui o dono
 * precisa receber mesmo sem regra. A trava é a própria notificação: antes de
 * avisar, procuramos uma `AdminNotification` da org com o mesmo `eventType` e
 * `eventPayload.entityKey`. Existindo, o item inteiro (sino, WhatsApp e
 * gatilho) é pulado. Rodar de novo no mesmo dia não duplica nada.
 */

import type { GetStepTools } from "inngest";
import type { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import { getAlertEvent } from "@/features/alerts/lib/alert-catalog";
import { broadcastComplianceItemDue } from "@/features/workflows/lib/agent-trigger-helpers";
import {
  collectComplianceAlerts,
  resolveBusinessDay,
  type BusinessDay,
  type ComplianceAlertCandidate,
} from "@/features/accounting/server/alerts/collect-compliance-alerts";
import { sendComplianceWhatsApp } from "@/features/accounting/server/alerts/send-compliance-whatsapp";
import { buildComplianceWhatsAppMessage } from "@/features/accounting/server/alerts/build-compliance-whatsapp-message";

/** Escopo opcional: só esta org (bateria de QA). O cron roda sem escopo. */
export interface DetectionScope {
  organizationId?: string;
}

export async function runComplianceDueDetection(
  step: Pick<GetStepTools<typeof inngest>, "run">,
  scope: DetectionScope = {},
) {
  const profiles = await step.run("list-orgs", () =>
    prisma.organizationTaxProfile.findMany({
      where: {
        onboardingCompletedAt: { not: null },
        ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
      },
      select: { organizationId: true },
    }),
  );

  const totals = { alerts: 0, skippedAsDuplicate: 0, whatsappSent: 0 };
  for (const { organizationId } of profiles) {
    // Uma org com dado quebrado não pode impedir o aviso das outras.
    const summary = await step.run(`detect-${organizationId}`, async () => {
      try {
        return await detectForOrganization(organizationId);
      } catch (error) {
        console.error(`[detect-compliance-due] org=${organizationId} falhou:`, error);
        return { delivered: 0, skippedAsDuplicate: 0, whatsappSent: 0 };
      }
    });
    totals.alerts += summary.delivered;
    totals.skippedAsDuplicate += summary.skippedAsDuplicate;
    totals.whatsappSent += summary.whatsappSent;
  }

  return { organizations: profiles.length, ...totals };
}

async function detectForOrganization(organizationId: string) {
  const now = new Date();
  const today: BusinessDay = resolveBusinessDay(now);
  const candidates = await collectComplianceAlerts(organizationId, today, now);

  const delivered: ComplianceAlertCandidate[] = [];
  let skippedAsDuplicate = 0;
  for (const candidate of candidates) {
    const entityKey = resolveEntityKey(candidate);
    if (!entityKey) continue;
    if (await isAlreadyDelivered(organizationId, candidate.eventType, entityKey)) {
      skippedAsDuplicate++;
      continue;
    }
    await deliverToBell(organizationId, candidate, entityKey);
    if (candidate.trigger) {
      await broadcastComplianceItemDue({ organizationId, entityKey, ...candidate.trigger });
    }
    delivered.push(candidate);
  }

  const whatsappResults = delivered.length > 0 ? await notifyAlertPhones(organizationId, delivered) : [];
  const whatsappFailures = whatsappResults.filter((result) => !result.isSent);
  if (whatsappFailures.length > 0) {
    console.warn(`[detect-compliance-due] WhatsApp não enviado (org=${organizationId}):`, whatsappFailures);
  }

  return {
    organizationId,
    candidates: candidates.length,
    delivered: delivered.length,
    skippedAsDuplicate,
    whatsappSent: whatsappResults.length - whatsappFailures.length,
    whatsappFailures,
  };
}

function resolveEntityKey(candidate: ComplianceAlertCandidate): string | null {
  const definition = getAlertEvent(candidate.eventType);
  if (!definition) return null;
  return definition.entityKey(candidate.payload);
}

async function isAlreadyDelivered(organizationId: string, eventType: string, entityKey: string): Promise<boolean> {
  const existing = await prisma.adminNotification.findFirst({
    where: {
      organizationId,
      eventType,
      eventPayload: { path: ["entityKey"], equals: entityKey },
    },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Regras configuradas em /settings/notifications mandam na audiência; sem
 * regra (ou se nenhuma entregou), os admins da org recebem direto.
 */
async function deliverToBell(organizationId: string, candidate: ComplianceAlertCandidate, entityKey: string) {
  const payload = { ...candidate.payload, entityKey };
  const activeRules = await prisma.alertRule.count({
    where: {
      eventType: candidate.eventType,
      isActive: true,
      OR: [{ organizationId: null }, { organizationId }],
    },
  });
  if (activeRules > 0) {
    const result = await dispatchAlert(candidate.eventType, payload);
    if (result.dispatchedCount > 0) return;
  }
  await dispatchAlert(candidate.eventType, payload, {
    bypassRules: {
      title: candidate.title,
      body: candidate.body,
      severity: candidate.severity,
      audience: { kind: "org_admins" },
      actionUrl: candidate.payload.actionUrl,
      orgId: organizationId,
      createdBy: "SYSTEM",
    },
  });
}

async function notifyAlertPhones(organizationId: string, delivered: ComplianceAlertCandidate[]) {
  const profile = await prisma.organizationTaxProfile.findUnique({
    where: { organizationId },
    select: { alertPhones: true },
  });
  const phones = profile?.alertPhones ?? [];
  if (phones.length === 0) return [];
  return sendComplianceWhatsApp({
    organizationId,
    phones,
    message: buildComplianceWhatsAppMessage(delivered),
  });
}
