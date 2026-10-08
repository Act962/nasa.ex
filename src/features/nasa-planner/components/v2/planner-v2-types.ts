import type { usePlannerCalendarPosts, usePlannerClients, usePlannerDrafts, usePlannerSlots } from "../../hooks/use-planner-calendar";

export type PlannerClient = ReturnType<typeof usePlannerClients>["clients"][number];
/** `groupAccountCount` vem do agrupamento do calendário (spec 0074, RF-14): quantas contas o cartão representa. */
export type CalendarPost = ReturnType<typeof usePlannerCalendarPosts>["posts"][number] & { groupAccountCount?: number };
export type DraftPost = ReturnType<typeof usePlannerDrafts>["posts"][number];
export type CalendarSlot = ReturnType<typeof usePlannerSlots>["slots"][number];

/** Abre o criador: post existente ou novo, com tipo e horário sugeridos. */
export type ComposerRequest =
  | { mode: "edit"; postId: string }
  | { mode: "create"; type: CalendarPost["type"]; intendedAt?: Date; organizationId?: string; momentKey?: string; title?: string };
