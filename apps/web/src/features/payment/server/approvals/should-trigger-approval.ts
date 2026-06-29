import "server-only";

import prisma from "@/lib/prisma";

/**
 * Decide se um novo PaymentEntry deve nascer em PENDING_APPROVAL.
 *
 * Trigger:
 *   1. `requiresApproval=true` no input (flag manual do form "Exigir aprovação").
 *   2. `governanceConfig.payableRequiresApproval=true` E `type === "PAYABLE"`.
 *   3. `amount >= governanceConfig.autoApprovalThresholdCents` (qualquer type).
 *
 * Retorna:
 *   - `triggered: boolean` — se algum dos 3 critérios bateu.
 *   - `thresholdSnapshotCents: number | null` — valor do threshold no momento
 *     da decisão. Snapshot pra preservar histórico se config global mudar.
 *
 * Quando o user não criou ainda nenhum `PaymentGovernanceConfig` (org nunca
 * abriu Settings → Governança), `governanceConfig` é null → trigger só por
 * flag manual.
 */
export async function shouldTriggerApproval(opts: {
  organizationId: string;
  amountCents: number;
  type: "PAYABLE" | "RECEIVABLE";
  requiresApprovalManual: boolean;
}): Promise<{ triggered: boolean; thresholdSnapshotCents: number | null }> {
  // Flag manual sempre vence.
  if (opts.requiresApprovalManual) {
    const config = await prisma.paymentGovernanceConfig.findUnique({
      where: { organizationId: opts.organizationId },
      select: { autoApprovalThresholdCents: true },
    });
    return {
      triggered: true,
      thresholdSnapshotCents: config?.autoApprovalThresholdCents ?? null,
    };
  }

  const config = await prisma.paymentGovernanceConfig.findUnique({
    where: { organizationId: opts.organizationId },
    select: {
      autoApprovalThresholdCents: true,
      payableRequiresApproval: true,
    },
  });

  if (!config) return { triggered: false, thresholdSnapshotCents: null };

  const triggeredByPayablePolicy =
    config.payableRequiresApproval && opts.type === "PAYABLE";
  const triggeredByThreshold =
    config.autoApprovalThresholdCents !== null &&
    opts.amountCents >= config.autoApprovalThresholdCents;

  return {
    triggered: triggeredByPayablePolicy || triggeredByThreshold,
    thresholdSnapshotCents: config.autoApprovalThresholdCents ?? null,
  };
}
