import dayjs from "dayjs";

export type EventBadge = "NOVO" | "QUASE_COMECANDO" | "EM_ALTA";

export interface BadgeInput {
  publishedAt?: Date | string | null;
  startDate?: Date | string | null;
  viewCount?: number | null;
  viewCountP90?: number | null;
}

export function computeBadges(ev: BadgeInput): EventBadge[] {
  const now = dayjs();
  const badges: EventBadge[] = [];

  if (ev.publishedAt) {
    const publishedAt = dayjs(ev.publishedAt);
    if (now.diff(publishedAt, "hour") < 48) badges.push("NOVO");
  }

  if (ev.startDate) {
    const start = dayjs(ev.startDate);
    const hoursUntil = start.diff(now, "hour");
    if (hoursUntil >= 0 && hoursUntil < 24) badges.push("QUASE_COMECANDO");
  }

  if (
    typeof ev.viewCount === "number" &&
    typeof ev.viewCountP90 === "number" &&
    ev.viewCountP90 > 0 &&
    ev.viewCount >= ev.viewCountP90
  ) {
    badges.push("EM_ALTA");
  }

  return badges;
}

export const BADGE_LABELS: Record<EventBadge, { label: string; emoji: string; className: string }> = {
  NOVO: {
    label: "Novo",
    emoji: "✨",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  QUASE_COMECANDO: {
    label: "Quase começando",
    emoji: "⏰",
    className: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  },
  EM_ALTA: {
    label: "Em alta",
    emoji: "🔥",
    className: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30",
  },
};
