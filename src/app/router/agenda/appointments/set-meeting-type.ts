import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const meetingTypeSchema = z.enum(["ONLINE", "IN_PERSON"]);

export const setAppointmentMeetingType = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      appointmentId: z.string().min(1),
      meetingType: meetingTypeSchema,
    }),
  )
  .handler(async ({ context, input, errors }) => {
    // Garante que o agendamento pertence à organização do usuário.
    const existing = await prisma.appointment.findFirst({
      where: {
        id: input.appointmentId,
        agenda: { organizationId: context.org.id },
      },
      select: { id: true, trackingId: true },
    });

    if (!existing) {
      throw errors.NOT_FOUND({ message: "Agendamento não encontrado" });
    }

    // Usa SQL bruto pra não depender do `prisma generate` ter sido rodado
    // após adicionar a coluna `meeting_type`/enum `MeetingType` no schema.
    // Se a coluna ainda não existir no DB, esta query vai estourar erro
    // claro pedindo a migration.
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "appointments" SET "meeting_type" = $1::"MeetingType", "updated_at" = NOW() WHERE id = $2`,
        input.meetingType,
        input.appointmentId,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("meeting_type") ||
        msg.includes("MeetingType") ||
        msg.includes("does not exist")
      ) {
        throw errors.INTERNAL_SERVER_ERROR({
          message:
            "Coluna `meeting_type` ainda não existe no banco. Rode `pnpm prisma migrate dev --name add_appointment_meeting_type` (ou aplique o SQL manualmente).",
        });
      }
      throw err;
    }

    return {
      appointment: {
        id: existing.id,
        trackingId: existing.trackingId,
        meetingType: input.meetingType,
      },
    };
  });
