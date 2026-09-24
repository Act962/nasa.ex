import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { parseWhen } from "../parse-when";
import { resolveSingleLead } from "../leads/resolve-lead";

// Marcar compromisso. Sem este verbo, "marca uma reunião com o Kauê sexta às
// 15h" caía em `agenda.reschedule_appointment`, que procura um agendamento
// que ainda não existe e responde que não achou.

const DEFAULT_DURATION_MINUTES = 60;

const inputSchema = z.object({
  startsAt: z
    .string()
    .trim()
    .min(2)
    .describe("Quando, com as palavras do usuário: 'sexta às 15h', 'amanhã 9h'."),
  title: z.string().trim().min(2).max(120).optional().describe("Assunto da reunião."),
  leadName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Cliente do compromisso, quando o usuário disser."),
  agendaName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Agenda onde marcar. Sem isso, usa a única da organização."),
  durationMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60)
    .optional()
    .describe("Duração em minutos. Sem isso, 60."),
});

function formatDateTime(value: Date): string {
  return value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const createAppointmentAction: AstroAction<typeof inputSchema> = {
  key: "appointment.create",
  app: "agenda",
  toolName: "create_appointment_slot",
  description:
    "MARCA um compromisso novo — 'marca uma reunião com o Fulano sexta às 15h', 'agenda uma call amanhã às 9h'. " +
    "É criar do zero; remarcar um que já existe é outro verbo.",
  permission: { appKey: "spacetime", action: "create" },
  requiresConfirmation: false,
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const startsAtIso = parseWhen(input.startsAt);
    if (!startsAtIso) {
      return {
        status: "needs_input",
        title: "Quando?",
        description: `Não entendi "${input.startsAt}" como data e hora.`,
        missingFields: [{ key: "startsAt", label: "o dia e a hora" }],
        appName: "Agendas",
      };
    }

    const agendas = await prisma.agenda.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(input.agendaName
          ? { name: { contains: input.agendaName, mode: "insensitive" } }
          : {}),
      },
      select: { id: true, name: true, slotDuration: true },
      take: 5,
    });

    if (agendas.length === 0) {
      return {
        status: "needs_input",
        title: "Agenda não encontrada",
        description: input.agendaName
          ? `Não achei agenda com "${input.agendaName}".`
          : "Você ainda não tem agenda nenhuma. Crie uma antes de marcar.",
        missingFields: [{ key: "agendaName", label: "o nome da agenda" }],
        appName: "Agendas",
      };
    }

    if (agendas.length > 1) {
      return {
        status: "ambiguous",
        title: "Em qual agenda?",
        description: `Você tem ${agendas.length} agendas. Em qual marco?`,
        field: "agendaName",
        options: agendas.map((agenda) => ({ id: agenda.id, label: agenda.name })),
        appName: "Agendas",
      };
    }

    const agenda = agendas[0];

    let leadId: string | undefined;
    let leadName: string | undefined;
    if (input.leadName) {
      const resolved = await resolveSingleLead({
        ctx,
        name: input.leadName,
        field: "leadName",
        appName: "Agendas",
      });
      if ("failure" in resolved) return resolved.failure;
      leadId = resolved.lead.id;
      leadName = resolved.lead.name;
    }

    const startsAt = new Date(startsAtIso);
    const durationMinutes =
      input.durationMinutes ?? agenda.slotDuration ?? DEFAULT_DURATION_MINUTES;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    // Marcar por cima de compromisso existente é o erro caro deste verbo: quem
    // fala rápido não confere a agenda antes.
    const conflict = await prisma.appointment.findFirst({
      where: {
        agendaId: agenda.id,
        status: { not: "CANCELLED" },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { title: true, startsAt: true },
    });
    if (conflict) {
      return {
        status: "error",
        title: "Horário ocupado",
        description:
          `Já existe "${conflict.title ?? "um compromisso"}" em ${formatDateTime(conflict.startsAt)} ` +
          `na agenda ${agenda.name}.`,
        internalUrl: "/agendas",
        openLabel: "Abrir Agendas",
        appName: "Agendas",
      };
    }

    const title = input.title ?? (leadName ? `Reunião com ${leadName}` : "Novo agendamento");

    if (dryRun) {
      return {
        status: "done",
        title: "Marcar compromisso",
        description: `"${title}" em ${formatDateTime(startsAt)}, na agenda ${agenda.name}.`,
        appName: "Agendas",
      };
    }

    await prisma.appointment.create({
      data: {
        title,
        startsAt,
        endsAt,
        agendaId: agenda.id,
        leadId: leadId ?? null,
        userId: ctx.userId,
      },
    });

    return {
      status: "done",
      title: "Compromisso marcado",
      description: `"${title}" em ${formatDateTime(startsAt)}, na agenda ${agenda.name}.`,
      internalUrl: "/agendas",
      openLabel: "Abrir Agendas",
      appName: "Agendas",
    };
  },
};
