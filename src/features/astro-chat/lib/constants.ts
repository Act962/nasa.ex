/** Limites e valores do ASTRO CHAT (spec 0031). */

export const ASTRO_CHAT_APP_SLUG = "astro-chat";
export const ASTRO_CHAT_AI_ACTION = "astro_chat_ai_message";
export const ASTRO_CHAT_DEFAULT_MONTHLY_STARS = 500;

export const MESSAGE_MAX_CHARS = 2000;
export const VISITOR_MIN_INTERVAL_MS = 2_000;
export const VISITOR_MESSAGES_PER_MINUTE = 20;
export const IP_MESSAGES_PER_MINUTE = 60;
export const IP_NEW_VISITORS_PER_HOUR = 20;
export const HUMAN_TAKEOVER_SILENCE_MS = 30 * 60_000;
export const MESSAGES_PAGE_SIZE = 50;

export const PAUSED_REASON = {
  noStars: "no_stars",
  trackingMissing: "tracking_missing",
} as const;
