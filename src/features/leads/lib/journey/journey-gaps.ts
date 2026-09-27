// Tempo parado na jornada do lead. Puro: usado pela linha do tempo da Jornada.

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/** Acima disso sem ninguém da equipe agir, o trecho fica vermelho. */
export const IDLE_ALERT_DAYS = 15;
/** Acima disso, âmbar. */
export const IDLE_WARN_DAYS = 3;

/** Eventos que vêm do lead ou do sistema — não são a equipe acionando o lead. */
const LEAD_SIDE_KINDS = new Set([
  "message_in",
  "form_submit",
  "public_link_viewed",
  "linnker_scan",
  "ctwa_referral",
  "utm_landing",
  "appointment_no_show",
  "sla_breached",
]);

export type GapSeverity = "ok" | "warn" | "idle";

export function isTeamTouch(kind: string): boolean {
  return !LEAD_SIDE_KINDS.has(kind);
}

export function gapSeverity(gapMs: number): GapSeverity {
  if (gapMs >= IDLE_ALERT_DAYS * DAY_MS) return "idle";
  if (gapMs >= IDLE_WARN_DAYS * DAY_MS) return "warn";
  return "ok";
}

/** "5 h", "3 dias", "2 semanas", "4 meses". */
export function formatGap(gapMs: number): string {
  if (gapMs < HOUR_MS) return "menos de 1 h";
  if (gapMs < DAY_MS) return `${Math.round(gapMs / HOUR_MS)} h`;
  const days = Math.round(gapMs / DAY_MS);
  if (days < 14) return `${days} dia${days === 1 ? "" : "s"}`;
  if (days < 60) return `${Math.round(days / 7)} semanas`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}

export interface JourneyPoint {
  id: string;
  kind: string;
  occurredAt: Date;
}

/**
 * Tempo desde a última ação da equipe até `now` — o "está parado há" do fim da
 * linha. Sem nenhuma ação da equipe, conta desde a entrada do lead.
 */
export function idleSinceLastTeamTouch(points: JourneyPoint[], leadCreatedAt: Date, now: Date): number {
  const lastTouch = points.filter((point) => isTeamTouch(point.kind)).at(-1)?.occurredAt ?? leadCreatedAt;
  return Math.max(0, now.getTime() - lastTouch.getTime());
}

/** Posição (0–100%) de um instante entre a entrada do lead e agora. */
export function positionOnSpan(instant: Date, start: Date, end: Date): number {
  const span = Math.max(1, end.getTime() - start.getTime());
  return Math.min(100, Math.max(0, ((instant.getTime() - start.getTime()) / span) * 100));
}
