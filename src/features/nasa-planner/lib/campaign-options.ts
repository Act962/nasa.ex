/** Valores aceitos pelas procedures de campanha e a checagem que liga um `<Select>` (string) a eles. */

export const CAMPAIGN_STATUS_VALUES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;
export const CAMPAIGN_EVENT_TYPE_VALUES = ["TRAINING", "STRATEGIC_MEETING", "REVIEW", "KICKOFF", "PRESENTATION", "DEADLINE"] as const;
export const CAMPAIGN_ASSET_TYPE_VALUES = ["LOGO", "COLOR_PALETTE", "FONT", "LINK", "DOCUMENT", "IMAGE", "VIDEO"] as const;
export const CAMPAIGN_TASK_PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const CAMPAIGN_TASK_STATUS_VALUES = ["PENDING", "IN_PROGRESS", "REVIEW", "COMPLETED", "BLOCKED"] as const;

export function isOneOf<Value extends string>(allowedValues: readonly Value[], candidate: string): candidate is Value {
  return allowedValues.some((allowedValue) => allowedValue === candidate);
}
