import { evaluateRules, type MatchOutcome } from "./match-rule";
import type { Automation, InboundEvent, Trigger } from "./types";

export type TriggerCandidate = {
  automation: Automation;
  trigger: Trigger;
  outcome: MatchOutcome;
  /** Gatilho de conteúdo específico ganha de gatilho "todos os conteúdos". */
  isSpecificTarget: boolean;
};

export type TriggerSelection = TriggerCandidate | null;

/**
 * O gatilho cobre o conteúdo do evento?
 *
 * É aqui que morre o match cruzado do comments-app, que casava keyword no
 * escopo da organização inteira e só depois conferia o post (spec 0024 D-3).
 */
export function triggerCoversContent(
  trigger: Trigger,
  event: InboundEvent,
): boolean {
  if (trigger.eventType !== event.type) return false;
  if (event.type === "DIRECT_MESSAGE_RECEIVED") return true;
  if (trigger.targetScope === "ALL_CONTENT") return true;
  if (trigger.targetScope === "NEXT_CONTENT") return false;

  const contentId = event.content?.externalId;
  if (!contentId) return false;
  return trigger.targets.some(
    (target) => target.externalContentId === contentId,
  );
}

/**
 * Escolhe UM gatilho entre todos os elegíveis — nunca mais de uma automação
 * responde ao mesmo comentário (spec 0024 RF-12, CA-9, CB-8).
 *
 * Desempate, em ordem:
 *   1. conteúdo específico ganha de "todos os conteúdos";
 *   2. mais termos casados (mais específico);
 *   3. gatilho mais antigo — critério estável, para o resultado não depender
 *      da ordem em que o banco devolveu as linhas.
 */
export function selectTrigger(
  automations: readonly Automation[],
  event: InboundEvent,
): TriggerSelection {
  const candidates: TriggerCandidate[] = [];

  for (const automation of automations) {
    if (!automation.isActive) continue;

    for (const trigger of automation.triggers) {
      if (!trigger.isEnabled) continue;
      if (!triggerCoversContent(trigger, event)) continue;

      const outcome = evaluateRules(
        trigger.rules,
        trigger.matchLogic,
        event.text,
      );
      if (!outcome.matched) continue;

      candidates.push({
        automation,
        trigger,
        outcome,
        isSpecificTarget: trigger.targetScope === "SPECIFIC_CONTENT",
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((left, right) => {
    if (left.isSpecificTarget !== right.isSpecificTarget) {
      return left.isSpecificTarget ? -1 : 1;
    }
    if (left.outcome.matchedTerms.length !== right.outcome.matchedTerms.length) {
      return right.outcome.matchedTerms.length - left.outcome.matchedTerms.length;
    }
    return left.trigger.createdAt.getTime() - right.trigger.createdAt.getTime();
  });

  return candidates[0];
}
