import "server-only";
import { trackLeadEvent } from "@/lib/lead-journey/track";

// Score de atendimento (spec 0113, RF-16, D-5): lançamentos na Jornada (`attendance_score`). A venda
// fechada (+10) sai dos eventos `won` que já existem, somados na consulta do Insights.

export const ATTENDANCE_SCORE_POINTS = {
  replied_in_time: 2,
  unanswered_beyond_time: -5,
  client_complained: -10,
  human_answered_waiting_client: 5,
  commitment_fulfilled: 5,
  no_show: -10,
} as const;

export type AttendanceScoreReason = keyof typeof ATTENDANCE_SCORE_POINTS;

export const WON_SALE_POINTS = 10;

export async function recordAttendanceScore(params: {
  leadId: string;
  reason: AttendanceScoreReason;
  sectionId?: string;
  /** Atendente que gerou o ponto; ausente quando é a empresa como um todo. */
  actorId?: string | null;
}): Promise<void> {
  await trackLeadEvent({
    leadId: params.leadId,
    kind: "attendance_score",
    actorId: params.actorId ?? null,
    metadata: {
      points: ATTENDANCE_SCORE_POINTS[params.reason],
      reason: params.reason,
      sectionId: params.sectionId ?? null,
    },
  });
}
