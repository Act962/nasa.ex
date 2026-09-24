import type { Automation, FlowStep, SendDirectMessageConfig } from "./types";

export type ReadinessIssue = {
  triggerId?: string;
  message: string;
};

function stepHasContent(step: FlowStep): boolean {
  if (step.kind === "SEND_DIRECT_MESSAGE") {
    const config = step.config as SendDirectMessageConfig;
    if (config.source === "AI") return Boolean(config.aiPrompt?.trim());
    return Boolean(config.text?.trim());
  }
  return (step.config as { variants: string[] }).variants.some(
    (variant) => variant.trim().length > 0,
  );
}

/**
 * O que ainda falta para a automação poder ser ativada.
 *
 * Também alimenta o estado de erro dos nós no canvas (spec 0024 RF-23) — a
 * mesma função responde "por que o botão de ativar está bloqueado" e "por que
 * este nó está vermelho", então os dois nunca discordam.
 */
export function findReadinessIssues(automation: Automation): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (automation.triggers.length === 0) {
    issues.push({ message: "Adicione um gatilho." });
    return issues;
  }

  for (const trigger of automation.triggers) {
    if (
      trigger.eventType === "COMMENT_CREATED" &&
      trigger.targetScope === "SPECIFIC_CONTENT" &&
      trigger.targets.length === 0
    ) {
      issues.push({
        triggerId: trigger.id,
        message: "Escolha ao menos uma publicação ou mude para todas.",
      });
    }

    const hasIncludeRule = trigger.rules.some(
      (rule) => rule.kind === "INCLUDE" && rule.operator !== "ANY_TEXT",
    );
    const hasAnyTextRule = trigger.rules.some(
      (rule) => rule.kind === "INCLUDE" && rule.operator === "ANY_TEXT",
    );
    if (!hasIncludeRule && !hasAnyTextRule && trigger.rules.length > 0) {
      issues.push({
        triggerId: trigger.id,
        message:
          "Só há regras de exclusão — adicione palavras-chave ou marque qualquer comentário.",
      });
    }

    const enabledSteps = trigger.steps.filter((step) => step.isEnabled);
    if (enabledSteps.length === 0) {
      issues.push({ triggerId: trigger.id, message: "Adicione uma resposta." });
      continue;
    }

    if (!enabledSteps.some(stepHasContent)) {
      issues.push({
        triggerId: trigger.id,
        message: "A resposta está vazia.",
      });
    }
  }

  return issues;
}
