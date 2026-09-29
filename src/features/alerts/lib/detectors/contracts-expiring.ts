/**
 * Cron: detect-contracts-expiring (spec 0029, RF-6)
 *
 * Todo dia às 08:00 (São Paulo), avisa contratos ativos que vencem em até
 * `daysBefore` dias (padrão 7) e propostas enviadas cuja validade termina no
 * mesmo prazo. Um alerta por dia por item até o vencimento (CA-4).
 */

import type { GetStepTools } from "inngest";
import type { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";

interface ExpiringParams {
  daysBefore?: number;
}

const DEFAULT_DAYS_BEFORE = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 300;

function daysUntil(date: Date, from: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - from.getTime()) / DAY_MS));
}

/** Escopo opcional: só esta org (bateria de QA). O cron roda sem escopo. */
export interface DetectionScope {
  organizationId?: string;
}

export async function runContractsExpiringDetection(
  step: Pick<GetStepTools<typeof inngest>, "run">,
  scope: DetectionScope = {},
) {
  const rules = await step.run("fetch-rules", () =>
    prisma.alertRule.findMany({
      where: {
        eventType: "forge.contract_expiring",
        isActive: true,
        ...(scope.organizationId
          ? {
              OR: [
                { organizationId: null },
                { organizationId: scope.organizationId },
              ],
            }
          : {}),
      },
      select: { id: true, organizationId: true, params: true },
    }),
  );
  if (rules.length === 0) return { rulesScanned: 0, dispatched: 0 };

  // Com várias regras, a janela maior cobre todas; o dedupe diário evita repetição.
  const daysBefore = Math.max(
    ...rules.map((rule) => {
      const params = (rule.params ?? {}) as ExpiringParams;
      return typeof params.daysBefore === "number"
        ? params.daysBefore
        : DEFAULT_DAYS_BEFORE;
    }),
  );
  const organizationIds = scope.organizationId
    ? [scope.organizationId]
    : rules.some((rule) => rule.organizationId === null)
      ? undefined
      : rules.map((rule) => rule.organizationId as string);

  const now = new Date();
  // Inclui o dia de hoje inteiro: contrato que vence hoje ainda precisa de aviso.
  const windowStart = new Date(now.getTime() - DAY_MS);
  const windowEnd = new Date(now.getTime() + daysBefore * DAY_MS);
  const orgFilter = organizationIds
    ? { organizationId: { in: organizationIds } }
    : {};

  const [contracts, proposals] = await step.run("fetch-expiring", () =>
    Promise.all([
      prisma.forgeContract.findMany({
        where: {
          status: "ATIVO",
          isTemplate: false,
          endDate: { gte: windowStart, lte: windowEnd },
          ...orgFilter,
        },
        take: BATCH_LIMIT,
        select: {
          id: true,
          number: true,
          endDate: true,
          organizationId: true,
          proposal: { select: { title: true } },
        },
      }),
      prisma.forgeProposal.findMany({
        where: {
          status: { in: ["ENVIADA", "VISUALIZADA"] },
          validUntil: { gte: windowStart, lte: windowEnd },
          ...orgFilter,
        },
        take: BATCH_LIMIT,
        select: {
          id: true,
          number: true,
          title: true,
          validUntil: true,
          organizationId: true,
        },
      }),
    ]),
  );

  const dispatched = await step.run("dispatch", async () => {
    let total = 0;
    const reference = new Date();

    for (const contract of contracts) {
      const result = await dispatchAlert("forge.contract_expiring", {
        kind: "contract",
        entityId: contract.id,
        contractTitle: contract.proposal?.title
          ? `contrato "${contract.proposal.title}"`
          : `contrato nº ${contract.number}`,
        daysLeft: daysUntil(new Date(contract.endDate), reference),
        actionUrl: "/forge",
        orgId: contract.organizationId,
      });
      total += result.dispatchedCount;
    }

    for (const proposal of proposals) {
      if (!proposal.validUntil) continue;
      const result = await dispatchAlert("forge.contract_expiring", {
        kind: "proposal",
        entityId: proposal.id,
        contractTitle: `proposta "${proposal.title}"`,
        daysLeft: daysUntil(new Date(proposal.validUntil), reference),
        actionUrl: "/forge",
        orgId: proposal.organizationId,
      });
      total += result.dispatchedCount;
    }

    return total;
  });

  return {
    rulesScanned: rules.length,
    contracts: contracts.length,
    proposals: proposals.length,
    dispatched,
  };
}
