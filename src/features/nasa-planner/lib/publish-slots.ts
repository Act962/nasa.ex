import type { NasaPlannerPostType } from "@/generated/prisma/enums";

/** Horários sugeridos do Planner (spec 0058, RF-7): padrão do mercado até a Fase 5 trazer os horários reais dos seguidores. */

// America/Sao_Paulo = UTC-3, fixo desde 2019 (sem horário de verão).
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SlotRule {
  weekday: number;
  minuteOfDay: number;
  postTypes: NasaPlannerPostType[];
  label: string;
}

/** Engajamento costuma ser maior no fim da manhã e no começo da noite, em dias úteis. */
export const DEFAULT_SLOT_RULES: SlotRule[] = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, minuteOfDay: 12 * 60, postTypes: ["STORY"] as NasaPlannerPostType[], label: "Seguidores mais ativos neste horário" },
  { weekday, minuteOfDay: 19 * 60, postTypes: ["REEL", "STATIC", "CAROUSEL"] as NasaPlannerPostType[], label: "Seguidores mais ativos neste horário" },
]);

export interface SlotInstance {
  startsAt: Date;
  postTypes: NasaPlannerPostType[];
  label: string;
}

/** Expande regras semanais em horários concretos entre `from` e `to`, já em UTC. */
export function expandSlotRules(rules: SlotRule[], from: Date, to: Date): SlotInstance[] {
  const instances: SlotInstance[] = [];
  const firstBrtMidnight = Date.UTC(
    new Date(from.getTime() - BRT_OFFSET_MS).getUTCFullYear(),
    new Date(from.getTime() - BRT_OFFSET_MS).getUTCMonth(),
    new Date(from.getTime() - BRT_OFFSET_MS).getUTCDate(),
  );
  for (let dayStartMs = firstBrtMidnight; dayStartMs + BRT_OFFSET_MS <= to.getTime(); dayStartMs += DAY_MS) {
    const weekday = new Date(dayStartMs).getUTCDay();
    for (const rule of rules.filter((candidate) => candidate.weekday === weekday)) {
      const startsAt = new Date(dayStartMs + rule.minuteOfDay * 60_000 + BRT_OFFSET_MS);
      if (startsAt >= from && startsAt <= to) instances.push({ startsAt, postTypes: rule.postTypes, label: rule.label });
    }
  }
  return instances;
}
