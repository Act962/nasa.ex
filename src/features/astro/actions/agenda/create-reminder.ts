import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ReminderRecurrenceType } from "@/generated/prisma/enums";
import { buildFirstRemindAt } from "@/lib/reminder-recurrence";
import { inngest } from "@/inngest/client";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "../leads/resolve-lead";
import { parseWhen } from "../parse-when";
import type { AstroPicker } from "@/features/astro/lib/astro-picker";

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

/** "9h", "9", "9:5" → "09:00", "09:00", "09:05". */
function normalizeTime(raw: string): string {
  const [hour, minute] = raw.trim().replace(/[hH]/, ":").split(":");
  const paddedHour = hour.padStart(2, "0");
  const paddedMinute = (minute ?? "").padEnd(2, "0").slice(0, 2) || "00";
  return `${paddedHour}:${paddedMinute}`;
}

const RECURRENCE_PICKER: AstroPicker = {
  kind: "select",
  options: [
    { label: "Uma vez", answer: "uma vez" },
    { label: "Toda semana", answer: "semanal" },
    { label: "A cada 15 dias", answer: "quinzenal" },
    { label: "Todo mês", answer: "mensal" },
  ],
};

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
  // Aceita como o usuário fala ("9h", "9:30", "09h00") e normaliza em código:
  // exigir HH:MM do modelo derrubava o verbo inteiro depois da ação certa,
  // e zerar um minuto é regra, não julgamento.
  remindTime: z
    .string()
    .trim()
    .regex(/^\d{1,2}\s*[:hH]\s*\d{0,2}$|^\d{1,2}$/)
    .transform(normalizeTime)
    .describe("Horário, ex: '9h', '09:30'."),
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

/** Fronteira de palavra que entende acento — `\b` do JS termina em "amanh|ã". */
const WORD_START = "(?<![\\p{L}\\d])";
const WORD_END = "(?![\\p{L}\\d])";

/** Data, hora e recorrência não fazem parte do que lembrar. */
const WHEN_EXPRESSIONS = [
  "(?:todo|todos\\s+os)\\s+dias?(?:\\s+\\d{1,2})?",
  "(?:no\\s+)?dia\\s+\\d{1,2}",
  "(?:toda|todo|todas|todos)(?:\\s+(?:as|os))?\\s+[\\p{L}-]+",
  "(?:a\\s+)?cada\\s+duas\\s+semanas",
  "depois\\s+de\\s+amanh[ãa]",
  "amanh[ãa]",
  "hoje",
  "(?:na\\s+|no\\s+)?(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-feira)?",
  "(?:[àa]s\\s+)?\\d{1,2}\\s*(?::|h)\\s*(?:\\d{2})?(?:\\s*h(?:oras)?)?",
  "semanal(?:mente)?|quinzenal(?:mente)?|mensal(?:mente)?",
].map((expression) => new RegExp(`${WORD_START}(?:${expression})${WORD_END}`, "giu"));

/**
 * "Me lembra amanhã às 9h de ligar para a Maria Clara" → "ligar para a Maria
 * Clara". A data pode vir antes ou depois do que lembrar, então tira as
 * expressões de tempo do resto da frase em vez de cortar no primeiro "amanhã".
 */
function extractReminderMessage(text: string): string | undefined {
  const afterVerb = text.match(
    /(?<![\p{L}])(?:me\s+lembr[ae](?:r)?|lembr[ae]-me|lembrete\s+(?:de|para|pra))\s+(.+)$/iu,
  )?.[1];
  if (!afterVerb) return undefined;
  let message = afterVerb.split(/[,.!?]/)[0];
  for (const expression of WHEN_EXPRESSIONS) message = message.replace(expression, " ");
  return message
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:de|que|para|pra)\s+/iu, "")
    .trim();
}

/**
 * Frequência e hora estão na própria frase e seguem regra fixa — quando o
 * modelo omite um deles, o verbo inteiro morre depois de já ter acertado a
 * ação. Ler daqui é determinístico; o que o modelo extraiu continua vencendo.
 */
function inferReminderFields(text: string): Record<string, unknown> {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const inferred: Record<string, unknown> = {};

  if (/\btodo (?:santo )?dia \d{1,2}\b/.test(normalized)) {
    inferred.recurrence = "mensal";
  } else if (/\b(?:todos os dias|todo dia|diariamente)\b/.test(normalized)) {
    // Não existe lembrete diário: o roteiro pergunta em vez de chutar semanal.
  } else if (/\b(toda|todo|todas|todos|semanal)\b/.test(normalized)) {
    inferred.recurrence = /\bmes\b|\bmensal\b/.test(normalized) ? "mensal" : "semanal";
  } else if (/\bquinzenal\b|\bcada duas semanas\b/.test(normalized)) {
    inferred.recurrence = "quinzenal";
  } else if (/\bmensal\b|\btodo mes\b/.test(normalized)) {
    inferred.recurrence = "mensal";
  }

  const time = normalized.match(/\b(\d{1,2})\s*(?::|h)\s*(\d{2})?\b/);
  if (time) {
    inferred.remindTime = `${time[1].padStart(2, "0")}:${time[2] ?? "00"}`;
  }

  // O que lembrar e a partir de quando também estão na frase (spec 0033, RF-9).
  const message = extractReminderMessage(text);
  if (message && message.length >= 2) inferred.message = message;
  const start = normalized.match(/\b(amanha|hoje|segunda|terca|quarta|quinta|sexta|sabado|domingo|dia \d{1,2})\b/)?.[1];
  if (start) inferred.firstRemindAt = start;

  return inferred;
}

export const createReminderAction: AstroAction<typeof inputSchema> = {
  key: "agenda.create_reminder",
  app: "agenda",
  toolName: "create_reminder",
  // A primeira frase é a única que chega ao classificador (ver `buildCatalog`),
  // então ela carrega o sinal: "me lembra" é o que distingue lembrete de nota.
  description:
    "Cria lembrete para avisar o usuário depois — 'me lembra de', 'não me deixa esquecer', com hora e recorrência. " +
    "Use quando o usuário disser 'me lembra de ligar pro Fulano toda segunda', " +
    "'cria um lembrete de cobrar o Fulano dia 5'.",
  permission: { appKey: "spacetime", action: "create" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: inferReminderFields,
  intentPatterns: [
    /\b(me lembra|me lembre|me lembrar|lembra-me|lembre-me)\b/,
    /\b(cria|criar|crie|novo|quero criar)\s+(um\s+)?(novo\s+)?lembrete\b/,
  ],
  fieldSteps: {
    message: {
      title: "Lembrar de quê?",
      question: "O que eu devo lembrar?",
      picker: { kind: "text", placeholder: "Ex.: ligar para a Maria Clara", maxLength: 500 },
    },
    recurrence: { title: "Com que frequência?", question: "Quando o lembrete se repete?", picker: RECURRENCE_PICKER },
    remindTime: {
      title: "Que horas?",
      question: "Em que horário eu lembro?",
      picker: { kind: "text", placeholder: "Ex.: 09:00", maxLength: 5 },
    },
  },

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
        picker: RECURRENCE_PICKER,
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
        picker: { kind: "datetime", mode: "date" },
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
