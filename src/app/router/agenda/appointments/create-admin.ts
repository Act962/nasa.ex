import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import z from "zod";

dayjs.extend(utc);
dayjs.extend(timezone);

export const createAdminAppointment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Create an appointment from the admin panel",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaId: z.string().min(1, "Agenda ID is required"),
      date: z.string().min(1, "Date is required"), // YYYY-MM-DD
      time: z.string().min(1, "Time is required"), // HH:mm
      name: z.string().min(1, "Name is required"),
      phone: z.string().min(1, "Phone is required"),
      email: z.email("Email inválido").optional().or(z.literal("")),
      notes: z.string().optional(),
      timeZone: z.string().optional(),
      meetingType: z.enum(["ONLINE", "IN_PERSON"]).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const agenda = await prisma.agenda.findFirst({
      where: {
        id: input.agendaId,
        organizationId: context.org.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slotDuration: true,
        trackingId: true,
        statusId: true,
        tags: { select: { id: true } },
      },
    });

    if (!agenda) {
      throw errors.NOT_FOUND({ message: "Agenda não encontrada" });
    }

    const startsAt = (dayjs as any).tz(
      `${input.date} ${input.time}`,
      input.timeZone || "America/Sao_Paulo",
    );
    const endsAt = startsAt.add(agenda.slotDuration, "minute");

    // Verificar conflito de horário
    const conflict = await prisma.appointment.findFirst({
      where: {
        agendaId: agenda.id,
        startsAt: { lt: endsAt.toDate() },
        endsAt: { gt: startsAt.toDate() },
        status: { notIn: ["CANCELLED"] },
      },
    });

    if (conflict) {
      throw errors.BAD_REQUEST({ message: "Este horário já está preenchido." });
    }

    // Buscar ou criar lead no CRM
    let lead = await prisma.lead.findFirst({
      where: { phone: input.phone, trackingId: agenda.trackingId },
    });

    if (!lead) {
      let statusId = agenda.statusId;
      if (!statusId) {
        const firstStatus = await prisma.status.findFirst({
          where: { trackingId: agenda.trackingId },
          orderBy: { order: "asc" },
        });

        if (!firstStatus) {
          throw errors.BAD_REQUEST({
            message: "A trilha da agenda não possui status configurados.",
          });
        }

        statusId = firstStatus.id;
      }

      lead = await prisma.lead.create({
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          trackingId: agenda.trackingId,
          statusId,
          source: "AGENDA",
        },
      });

      // Só ADICIONA tags da agenda ao lead novo. Nunca remove tags
      // existentes (leads pré-existentes nem entram aqui).
      if (agenda.tags.length > 0) {
        await prisma.leadTag.createMany({
          data: agenda.tags.map((tag) => ({
            leadId: lead!.id,
            tagId: tag.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        agendaId: agenda.id,
        leadId: lead.id,
        userId: context.user.id,
        startsAt: startsAt.toDate(),
        endsAt: endsAt.toDate(),
        title: `Agendamento: ${input.name}`,
        notes: input.notes,
        status: "CONFIRMED",
        trackingId: agenda.trackingId,
      },
    });

    // Define o meetingType via SQL bruto (não depende do prisma generate ter
    // sido rodado após adicionar a coluna `meeting_type`).
    if (input.meetingType) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "appointments" SET "meeting_type" = $1::"MeetingType" WHERE id = $2`,
          input.meetingType,
          appointment.id,
        );
      } catch {
        // Silencia: se a coluna ainda não existe no DB, ignora — o appointment
        // já foi criado com o default ONLINE (ou ficará como tal após migration).
      }
    }

    // Log activity (action alinhada com a regra global "appointment_create")
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "spacetime",
      action: "appointment_create",
      actionLabel: `Criou agendamento para ${input.name} em ${input.date} às ${input.time} (${agenda.name})`,
      resource: input.name,
      resourceId: appointment.id,
      metadata: { agendaName: agenda.name, date: input.date, time: input.time, phone: input.phone },
    });

    // Cobra Stars conforme regra global `appointment_create`.
    await chargeStarsByAction(context.org.id, "appointment_create", {
      userId: context.user.id,
      description: `Criou agendamento (${agenda.name})`,
      appSlug: "spacetime",
    });

    return { success: true, appointment };
  });
