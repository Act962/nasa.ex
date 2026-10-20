// Builders de teste do domínio social. Sem I/O: só montam objetos válidos com sobrescrita pontual.
import type { Automation, FlowStep, InboundEvent, MatchRule, Trigger } from "./types";

export function buildStep(overrides: Partial<FlowStep> = {}): FlowStep {
  return {
    id: "step-1",
    kind: "REPLY_TO_COMMENT",
    order: 0,
    isEnabled: true,
    config: { variants: ["Te chamei no direct!"], strategy: "RANDOM" },
    ...overrides,
  };
}

export function buildRule(overrides: Partial<MatchRule> = {}): MatchRule {
  return { id: "rule-1", kind: "INCLUDE", operator: "CONTAINS", terms: ["preço"], ...overrides };
}

export function buildTrigger(overrides: Partial<Trigger> = {}): Trigger {
  return {
    id: "trigger-1",
    automationId: "automation-1",
    eventType: "COMMENT_CREATED",
    targetScope: "ALL_CONTENT",
    matchLogic: "ANY_RULE",
    isEnabled: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    targets: [],
    rules: [],
    steps: [buildStep()],
    ...overrides,
  };
}

export function buildAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: "automation-1",
    organizationId: "org-1",
    channelId: "channel-1",
    name: "Automação",
    isActive: true,
    triggers: [buildTrigger()],
    ...overrides,
  };
}

export function buildCommentEvent(overrides: Partial<InboundEvent> = {}): InboundEvent {
  return {
    provider: "INSTAGRAM",
    externalAccountId: "account-1",
    externalEventId: "event-1",
    type: "COMMENT_CREATED",
    actor: { externalUserId: "user-1" },
    text: "qual o preço?",
    content: { externalId: "post-1" },
    occurredAt: new Date("2026-06-01T12:00:00Z"),
    ...overrides,
  };
}
