import "server-only";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { WON_SALE_POINTS } from "@/features/org-defaults/lib/attendance/score";

// Score de atendimento (spec 0113, RF-16): soma dos lançamentos `attendance_score` mais +10 por venda ganha
// (eventos `won` que já existem), no período e no escopo da empresa.

export interface AttendanceScoreSummary {
  totalPoints: number;
  eventCount: number;
  wonSales: number;
  wonSalePoints: number;
  byReason: { reason: string; points: number; count: number }[];
  byAttendant: { userId: string; name: string; image: string | null; points: number }[];
}

export async function computeAttendanceScore(params: {
  organizationId: string;
  trackingId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<AttendanceScoreSummary> {
  const periodFilter = Prisma.sql`
    ${params.startDate ? Prisma.sql`AND e.occurred_at >= ${params.startDate}` : Prisma.empty}
    ${params.endDate ? Prisma.sql`AND e.occurred_at <= ${params.endDate}` : Prisma.empty}
    ${params.trackingId ? Prisma.sql`AND l.tracking_id = ${params.trackingId}` : Prisma.empty}
  `;

  const [reasonRows, attendantRows, wonRows] = await Promise.all([
    prisma.$queryRaw<{ reason: string; points: bigint; count: bigint }[]>`
      SELECT e.metadata->>'reason' AS reason,
             COALESCE(SUM((e.metadata->>'points')::int), 0) AS points,
             COUNT(*) AS count
      FROM lead_journey_events e
      JOIN leads l ON l.id = e.lead_id
      JOIN tracking t ON t.id = l.tracking_id
      WHERE e.kind = 'attendance_score' AND t.organization_id = ${params.organizationId}
      ${periodFilter}
      GROUP BY 1
    `,
    prisma.$queryRaw<{ userId: string; points: bigint }[]>`
      SELECT e.actor_id AS "userId", COALESCE(SUM((e.metadata->>'points')::int), 0) AS points
      FROM lead_journey_events e
      JOIN leads l ON l.id = e.lead_id
      JOIN tracking t ON t.id = l.tracking_id
      WHERE e.kind = 'attendance_score' AND e.actor_id IS NOT NULL AND t.organization_id = ${params.organizationId}
      ${periodFilter}
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 20
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM lead_journey_events e
      JOIN leads l ON l.id = e.lead_id
      JOIN tracking t ON t.id = l.tracking_id
      WHERE e.kind = 'won' AND t.organization_id = ${params.organizationId}
      ${periodFilter}
    `,
  ]);

  const byReason = reasonRows.map((row) => ({ reason: row.reason, points: Number(row.points), count: Number(row.count) }));
  const wonSales = Number(wonRows[0]?.count ?? 0);
  const users = await prisma.user.findMany({
    where: { id: { in: attendantRows.map((row) => row.userId) } },
    select: { id: true, name: true, image: true },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  return {
    totalPoints: byReason.reduce((sum, row) => sum + row.points, 0) + wonSales * WON_SALE_POINTS,
    eventCount: byReason.reduce((sum, row) => sum + row.count, 0),
    wonSales,
    wonSalePoints: wonSales * WON_SALE_POINTS,
    byReason,
    byAttendant: attendantRows.map((row) => ({
      userId: row.userId,
      name: userById.get(row.userId)?.name ?? "Atendente",
      image: userById.get(row.userId)?.image ?? null,
      points: Number(row.points),
    })),
  };
}
