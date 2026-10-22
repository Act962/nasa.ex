"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAttendanceScore } from "@/features/insights/hooks/use-attendance-score";
import { ATTENDANCE_SCORE_REASON_LABEL } from "@/features/org-defaults/lib/attendance/labels";

// Score de atendimento (spec 0113, RF-16): total do período, de onde veio e ranking por atendente.

interface AttendanceScoreCardProps {
  trackingId?: string;
  startDate?: string;
  endDate?: string;
}

export function AttendanceScoreCard({ trackingId, startDate, endDate }: AttendanceScoreCardProps) {
  const { score, isLoading } = useAttendanceScore({ trackingId, startDate, endDate });
  if (isLoading || !score || (score.eventCount === 0 && score.wonSales === 0)) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Score de atendimento</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[auto_1fr_1fr]">
        <div>
          <p className={cn("text-3xl font-bold", score.totalPoints < 0 ? "text-destructive" : "text-foreground")}>
            {score.totalPoints > 0 ? `+${score.totalPoints}` : score.totalPoints}
          </p>
          <p className="text-xs text-muted-foreground">pontos no período</p>
        </div>
        <ul className="grid gap-1 text-xs">
          {score.byReason.map((row) => (
            <li key={row.reason} className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {ATTENDANCE_SCORE_REASON_LABEL[row.reason] ?? row.reason} ({row.count})
              </span>
              <span className={row.points < 0 ? "text-destructive" : ""}>{row.points > 0 ? `+${row.points}` : row.points}</span>
            </li>
          ))}
          {score.wonSales > 0 && (
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Vendas fechadas ({score.wonSales})</span>
              <span>+{score.wonSalePoints}</span>
            </li>
          )}
        </ul>
        <ol className="grid content-start gap-1 text-xs">
          {score.byAttendant.slice(0, 5).map((attendant, position) => (
            <li key={attendant.userId} className="flex justify-between gap-2">
              <span className="truncate">
                {position + 1}. {attendant.name}
              </span>
              <span className={attendant.points < 0 ? "text-destructive" : ""}>
                {attendant.points > 0 ? `+${attendant.points}` : attendant.points}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
