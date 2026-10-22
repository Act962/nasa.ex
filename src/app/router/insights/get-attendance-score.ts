import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import { z } from "zod";
import { computeAttendanceScore } from "@/features/insights/lib/metrics/attendance-score";
import { isAttendanceStateEnabled } from "@/features/org-defaults/lib/attendance/flag";

// Score de atendimento da empresa e ranking por atendente (spec 0113, RF-16).
export const getAttendanceScore = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      trackingId: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    // Sem o estado de atendimento não há lançamentos: o card não aparece (só vendas viraria um "Score" falso).
    if (!isAttendanceStateEnabled(context.org.id)) return null;
    return computeAttendanceScore({
      organizationId: context.org.id,
      trackingId: input.trackingId,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    });
  });
