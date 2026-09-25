import { findReadinessIssues } from "../domain/automation-readiness";
import {
  AutomationIncompleteError,
  AutomationNotFoundError,
  ChannelNeedsReconnectError,
} from "../domain/errors";
import type { AutomationRepository, ChannelRepository } from "../ports/repositories";

export type ActivateAutomationDeps = {
  automations: AutomationRepository;
  channels: ChannelRepository;
};

/**
 * Liga ou desliga a automação.
 *
 * Desligar nunca é bloqueado — só ligar exige que tudo esteja no lugar. Uma
 * automação pela metade que "está ativa" é pior que uma desligada: ela silencia
 * em produção sem dizer por quê.
 */
export async function setAutomationActive(
  input: { automationId: string; isActive: boolean },
  deps: ActivateAutomationDeps,
): Promise<void> {
  const automation = await deps.automations.findById(input.automationId);
  if (!automation) throw new AutomationNotFoundError();

  if (!input.isActive) {
    await deps.automations.setActive(input.automationId, false);
    return;
  }

  const channel = await deps.channels.findForTenant();
  if (channel && channel.status !== "ACTIVE") {
    throw new ChannelNeedsReconnectError(channel.lastErrorMessage ?? undefined);
  }

  const issues = findReadinessIssues(automation);
  if (issues.length > 0) {
    throw new AutomationIncompleteError(issues[0].message);
  }

  await deps.automations.setActive(input.automationId, true);
}
