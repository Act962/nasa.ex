import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ReminderRecurrenceType } from "@/generated/prisma/enums";
import { buildFirstRemindAt } from "@/lib/reminder-recurrence";
import { inngest } from "@/inngest/client";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "../leads/resolve-lead";

// Lembrete recorrente (spec 0024, onda 1). É o verbo que mais se diz falando:
// "me lembra de ligar pro Kauê toda segunda".

const inputSchema = z.object({
  message: z.string().trim().min(2).max(500).describe("O que lembrar."),
  recurrence: z
    .enum(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY"])
    .describe("Frequência. 'toda segunda' é WEEKLY, 'todo dia 5' é MONTHLY."),
  remindTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .describe("Horário no formato HH:MM."),
  firstRemindAt: z
    .string()
    .datetime()
    .optional()
    .describe("Primeira ocorrência em ISO 8601. Obrigatório fora de MONTHLY por dia fixo."),
  dayOfMonth: z
    .number()
    .int()
    .min(1)
    .max(28)
    .optional()
    .describe("Dia do mês, para MONTHLY com dia fixo."),
  leadName: z
    .string()
    .trim()
    .optional()
    .describe("Lead a que o lembrete se refere, quando houver."),
});

export const createReminderAction: AstroAction<typeof inputSchema> = {
  key: "agenda.create_reminder",
  toolName: "create_reminder",
  description:
    "Cria um lembrete, único ou recorrente. " +
    "Use quando o usuário disser 'me lembra de ligar pro Fulano toda segunda', " +
    "'cria um lembrete de cobrar o Fulano dia 5'.",
  requiresConfirmation: false,
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    // MONTHLY com dia fixo dispensa data inicial; o resto exige.
    const isMonthlyByDay =
      input.recurrence === "MONTHLY" && input.dayOfMonth !== undefined;
    if (!isMonthlyByDay && !input.firstRemindAt) {
      return {
        status: "needs_input",
        title: "Falta quando começar",
        description: "Me diga a partir de quando esse lembrete vale.",
        missingFields: [{ key: "firstRemindAt", label: "data do primeiro lembrete" }],
        appName: "Agendas",
      };
    }

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

    const RECURRENCE_LABEL: Record<string, string> = {
      ONCE: "uma vez",
      WEEKLY: "toda semana",
      BIWEEKLY: "a cada duas semanas",
      MONTHLY: "todo mês",
    };
    const quando = `${RECURRENCE_LABEL[input.recurrence]} às ${input.remindTime}`;

    if (dryRun) {
      return {
        status: "done",
        title: "Criar lembrete",
        description: `"${input.message}" — ${quando}${leadName ? `, sobre ${leadName}` : ""}.`,
        appName: "Agendas",
      };
    }

    const reminder = await prisma.reminder.create({
      data: {
        createdByUserId: ctx.userId,
        message: input.message,
        recurrenceType: input.recurrence as ReminderRecurrenceType,
        dayOfMonth: input.dayOfMonth ?? null,
        remindTime: input.remindTime,
        // Mesmo cálculo da tela: o campo persistido é `nextRemindAt`, não a
        // data que o usuário disse.
        nextRemindAt: buildFirstRemindAt(
          input.remindTime,
          input.firstRemindAt,
          input.dayOfMonth,
        ),
        leadId: leadId ?? null,
      },
    });

    // O disparo mora no Inngest, que hiberna até a hora. Sem este evento o
    // lembrete fica no banco e nunca toca.
    await inngest.send({
      name: "reminder/created",
      data: { reminderId: reminder.id },
    });

    return {
      status: "done",
      title: "Lembrete criado",
      description: `Vou te lembrar ${quando}: "${input.message}"${leadName ? ` (sobre ${leadName})` : ""}.`,
      internalUrl: "/agendas",
      appName: "Agendas",
    };
  },
};
