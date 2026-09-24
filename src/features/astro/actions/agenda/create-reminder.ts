import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ReminderRecurrenceType } from "@/generated/prisma/enums";
import { buildFirstRemindAt } from "@/lib/reminder-recurrence";
import { inngest } from "@/inngest/client";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "../leads/resolve-lead";
import { parseWhen } from "../parse-when";

// Lembrete recorrente (spec 0024, onda 1). É o verbo que mais se diz falando:
// "me lembra de ligar pro Kauê toda segunda".

const RECURRENCE_ALIASES: Record<string, ReminderRecurrenceType> = {
  once: "ONCE",
  "uma vez": "ONCE",
  unico: "ONCE",
  weekly: "WEEKLY",
  semanal: "WEEKLY",
  semanalmente: "WEEKLY",
  biweekly: "BIWEEKLY",
  quinzenal: "BIWEEKLY",
  monthly: "MONTHLY",
  mensal: "MONTHLY",
  mensalmente: "MONTHLY",
};

function normalizeRecurrence(raw: string): ReminderRecurrenceType | null {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return RECURRENCE_ALIASES[key] ?? null;
}

const inputSchema = z.object({
  message: z.string().trim().min(2).max(500).describe("O que lembrar."),
  // String livre, não enum: o classificador responde em português ("semanal")
  // e o enum recusava, derrubando o verbo inteiro depois da ação certa.
  // Traduzir aqui é vocabulário conhecido — não é trabalho de modelo.
  recurrence: z
    .string()
    .trim()
    .min(3)
    .describe("Frequência: uma vez, semanal, quinzenal ou mensal."),
  remindTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .describe("Horário no formato HH:MM."),
  firstRemindAt: z
    .string()
    .trim()
    .optional()
    .describe("Quando começa, com as palavras do usuário: 'toda segunda', 'amanhã'."),
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
  // A primeira frase é a única que chega ao classificador (ver `buildCatalog`),
  // então ela carrega o sinal: "me lembra" é o que distingue lembrete de nota.
  description:
    "Cria lembrete para avisar o usuário depois — 'me lembra de', 'não me deixa esquecer', com hora e recorrência. " +
    "Use quando o usuário disser 'me lembra de ligar pro Fulano toda segunda', " +
    "'cria um lembrete de cobrar o Fulano dia 5'.",
  requiresConfirmation: false,
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    // MONTHLY com dia fixo dispensa data inicial; o resto exige.
    const recurrence = normalizeRecurrence(input.recurrence);
    if (!recurrence) {
      return {
        status: "needs_input",
        title: "Frequência não entendida",
        description: `Não sei o que é "${input.recurrence}". Uma vez, semanal, quinzenal ou mensal?`,
        missingFields: [{ key: "recurrence", label: "a frequência" }],
        appName: "Agendas",
      };
    }

    // `dayOfMonth` só faz sentido em MONTHLY; fora disso o modelo às vezes
    // preenche com lixo, e o campo entraria no banco sem significado.
    const dayOfMonth = recurrence === "MONTHLY" ? input.dayOfMonth : undefined;
    const isMonthlyByDay = recurrence === "MONTHLY" && dayOfMonth !== undefined;
    // A frase que diz a recorrência ("toda segunda") costuma ser a mesma que
    // diz o início — então tentamos resolver dali antes de perguntar.
    const firstRemindAt = input.firstRemindAt
      ? parseWhen(input.firstRemindAt) ?? parseWhen(`${input.firstRemindAt} ${input.remindTime}`)
      : parseWhen(`${input.message} ${input.remindTime}`);
    if (!isMonthlyByDay && !firstRemindAt) {
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
    const quando = `${RECURRENCE_LABEL[recurrence]} às ${input.remindTime}`;

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
        recurrenceType: recurrence,
        dayOfMonth: dayOfMonth ?? null,
        remindTime: input.remindTime,
        // Mesmo cálculo da tela: o campo persistido é `nextRemindAt`, não a
        // data que o usuário disse.
        nextRemindAt: buildFirstRemindAt(
          input.remindTime,
          firstRemindAt ?? undefined,
          dayOfMonth,
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
