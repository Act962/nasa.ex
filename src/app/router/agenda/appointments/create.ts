import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import z from "zod";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { recordAppointmentChange } from "@/features/org-defaults/lib/attendance/appointment";
import { findOrCreateAgendaLead, insertAgendaAppointment } from "@/features/agenda/server/appointment-commands";
import {
  trackingParamsSchema,
  trackingToLeadData,
  shouldLogUtmLanding,
} from "@/lib/tracking/tracking-params";
import { recordLeadOriginFromLead } from "@/features/leads/lib/lead-origin/record-lead-origin";

dayjs.extend(utc);
dayjs.extend(timezone);

export const createAppointment = base
  .route({
    method: "POST",
    summary: "Create an appointment",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaSlug: z.string().min(1, "Agenda slug is required"),
      orgSlug: z.string().min(1, "Organization slug is required"),
      date: z.string().min(1, "Date is required"),
      time: z.string().min(1, "Time is required"),
      name: z.string().min(1, "Name is required"),
      phone: z.string().min(1, "Phone is required"),
      email: z.email("Email inválido").optional().or(z.literal("")),
      notes: z.string().optional(),
      timeZone: z.string().optional(),
      tracking: trackingParamsSchema.optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const agenda = await prisma.agenda.findFirst({
      where: {
        slug: input.agendaSlug,
        organization: {
          slug: input.orgSlug,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slotDuration: true,
        trackingId: true,
        organizationId: true,
        statusId: true,
        tags: { select: { id: true } },
      },
    });

    if (!agenda) {
      throw errors.NOT_FOUND({
        message: "Agenda não encontrada",
      });
    }

    const startsAt = (dayjs as any).tz(
      `${input.date} ${input.time}`,
      input.timeZone || "America/Sao_Paulo",
    );
    const endsAt = startsAt.add(agenda.slotDuration, "minute");

    // Verificar se já existe agendamento no horário
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        agendaId: agenda.id,
        startsAt: {
          lt: endsAt.toDate(),
        },
        endsAt: {
          gt: startsAt.toDate(),
        },
        status: {
          notIn: ["CANCELLED"],
        },
      },
    });

    if (existingAppointment) {
      throw errors.BAD_REQUEST({
        message: "Este horário já está preenchido.",
      });
    }

    const t = input.tracking;
    const { lead, isNewLead } = await findOrCreateAgendaLead(agenda, {
      name: input.name,
      phone: input.phone,
      email: input.email,
      leadData: trackingToLeadData(t),
    });

    if (isNewLead) {
      // Origem real do lead (spec 0114): a agenda pública.
      await recordLeadOriginFromLead(lead.id, { origin: "AGENDA", sourceName: agenda.name, sourceId: agenda.id });
      if (shouldLogUtmLanding(t)) {
        await trackLeadEvent({
          leadId: lead.id,
          kind: "utm_landing",
          metadata: {
            utmSource: t?.utmSource,
            utmMedium: t?.utmMedium,
            utmCampaign: t?.utmCampaign,
            utmContent: t?.utmContent,
            utmTerm: t?.utmTerm,
            landingPage: t?.landingPage,
            referrer: t?.referrer,
          },
        });
      }
    }

    const inserted = await insertAgendaAppointment({
      agendaId: agenda.id,
      leadId: lead.id,
      startsAt: startsAt.toDate(),
      endsAt: endsAt.toDate(),
      title: `Agendamento: ${input.name}`,
      notes: input.notes,
      status: "PENDING",
      trackingId: agenda.trackingId,
    });
    if (!inserted.ok) {
      throw errors.BAD_REQUEST({ message: "Este horário já está preenchido." });
    }
    const { appointment } = inserted;

    await trackLeadEvent({
      leadId: lead.id,
      kind: "appointment_created",
      metadata: {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt,
      },
    });

    // Cobra Stars da org dona da agenda (regra global `appointment_create`).
    // Endpoint público — não tem userId; charge fica no nível org só.
    await chargeStarsByAction(agenda.organizationId, "appointment_create", {
      description: `Novo agendamento: ${input.name}`,
      appSlug: "spacetime",
    });

    await recordAppointmentChange({ appointmentId: appointment.id, change: "scheduled" }).catch((error: unknown) => console.warn("[agenda.create] atendimento do agendamento falhou", error));

    return {
      success: true,
      appointment,
    };
  });
