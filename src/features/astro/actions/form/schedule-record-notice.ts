import "server-only";
import { z } from "zod";
import type { AstroAction, AstroActionResult } from "../types";
import {
  DEFAULT_DAILY_HOUR,
  RECORDS_DAILY_NOTICE,
  resolveNoticeChannel,
  saveRecordNotice,
} from "@/features/form-records/server/record-notices";

// "Me manda as fichas do dia todo dia às 7h" (spec 0081, RF-17): liga o resumo do dia das fichas
// no WhatsApp de quem pediu. É preferência da própria pessoa, por isso não pede confirmação.

const inputSchema = z.object({
  hourText: z.string().trim().optional().describe("Hora dita pelo usuário, ex.: '7h', '18:00'."),
});

function readHour(hourText: string | undefined): number | null {
  const match = hourText?.match(/\b(\d{1,2})\s*(?:h|:|horas?)/i) ?? hourText?.match(/^\s*(\d{1,2})\s*$/);
  if (!match) return null;
  const hour = Number(match[1]);
  return hour >= 0 && hour <= 23 ? hour : null;
}

export const scheduleDailyRecordsAction: AstroAction<typeof inputSchema> = {
  key: "form.schedule_daily_records",
  app: "form",
  toolName: "schedule_daily_records_notice",
  description:
    "Liga o RESUMO DIÁRIO das fichas no WhatsApp do usuário, numa hora fixa — 'todo dia às 7h me manda as fichas do dia', " +
    "'me envia a lista de manutenções do dia todo dia às 8h'. Não é lembrete avulso nem compromisso.",
  permission: { appKey: "formularios", action: "view" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: (text) => {
    // Sem `\b` antes de "às": "à" não é caractere de palavra para a regex, e a hora dita era ignorada.
    const hour = text.match(/(?:^|\s)(?:as|às)\s*(\d{1,2}\s*(?:h|:\d{2}|horas?)\w*)/i)?.[1];
    return hour ? { hourText: hour } : {};
  },
  intentPatterns: [
    /\b(todo dia|todos os dias|diariamente)\b.{0,80}\bfichas?\b/,
    /\bfichas?\b.{0,80}\b(todo dia|todos os dias|diariamente)\b/,
  ],

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const channel = await resolveNoticeChannel({ userId: ctx.userId, organizationId: ctx.organizationId });
    if (!channel) {
      return {
        status: "error",
        title: "Número não liberado",
        description: "Seu número não está liberado no ASTRO desta empresa. Peça ao administrador para adicioná-lo em ASTRO › WhatsApp.",
        appName: "Formulários",
      };
    }
    const hour = readHour(input.hourText) ?? DEFAULT_DAILY_HOUR;
    const hourLabel = `${String(hour).padStart(2, "0")}:00`;
    if (dryRun) {
      return { status: "done", title: "Resumo diário das fichas", description: `Todo dia às ${hourLabel}.`, appName: "Formulários" };
    }
    await saveRecordNotice({ userId: ctx.userId, organizationId: ctx.organizationId, notifType: RECORDS_DAILY_NOTICE, isOn: true, hour });
    return {
      status: "done",
      title: "Resumo diário ligado",
      description: `Todo dia às ${hourLabel} eu mando aqui as fichas previstas do dia e as vencidas. Sem nada previsto, não mando. Para desligar: ASTRO › WhatsApp.`,
      internalUrl: "/astro?aba=whatsapp",
      openLabel: "Abrir avisos",
      appName: "Formulários",
    };
  },
};
