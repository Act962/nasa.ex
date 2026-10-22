import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { answerAppointmentCheck } from "@/features/org-defaults/lib/attendance/appointment";

// Resposta da equipe no cartão interno do agendamento (spec 0113, RF-18).
export const answerAppointmentCheckRoute = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      checkId: z.string().min(1),
      answer: z.enum(["attended", "not_yet", "cancelled"]),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const check = await prisma.leadJourneyEvent.findFirst({
      where: {
        id: input.checkId,
        kind: "appointment_check",
        lead: { tracking: { organizationId: context.org.id } },
      },
      select: { id: true },
    });
    if (!check) throw errors.NOT_FOUND({ message: "Conferência não encontrada" });
    return answerAppointmentCheck({ checkId: check.id, answer: input.answer, userId: context.user.id });
  });
