import "server-only";
import type { AstroActionResult } from "../types";
import { parseDateTime } from "../parse-when";
import type { AstroPicker } from "@/features/astro/lib/astro-picker";

// Dia e hora de compromisso, compartilhados por marcar e remarcar
// (spec 0033, RF-3/RF-4): só das palavras do usuário, com seletor quando
// faltar, e sempre mostrados por extenso no fuso de Brasília.

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

export const DATETIME_PICKER: AstroPicker = { kind: "datetime", mode: "datetime" };

export function formatAgendaTime(value: Date): string {
  return value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: BRAZIL_TIME_ZONE });
}

export function formatAgendaDay(value: Date): string {
  return value.toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

/** "segunda-feira, 28/09, às 14:00" — sempre com o dia da semana (RF-4). */
export function formatAgendaDateTime(value: Date): string {
  return `${formatAgendaDay(value)}, às ${formatAgendaTime(value)}`;
}

/**
 * Resolve o horário pelas palavras do usuário: a resposta à pergunta vem na
 * frente da frase original ("quinta 9h" vence "segunda"). O `startsAt` do
 * classificador só vale sem frase — ele já inventou 00:00 para "amanhã".
 */
export function resolveWhenOrAsk(params: {
  answeredWhen?: string;
  spokenWhen?: string;
  startsAt?: string;
  /** Verbo da pergunta: "marco", "remarco". */
  verb: string;
}): { iso: string } | { ask: AstroActionResult } {
  const whenText = [params.answeredWhen, params.spokenWhen ?? params.startsAt].filter(Boolean).join(" ");
  const when = parseDateTime(whenText);
  const ask = (title: string, description: string, label: string, picker: AstroPicker) => ({
    ask: {
      status: "needs_input" as const,
      title,
      description,
      missingFields: [{ key: "answeredWhen", label }],
      appName: "Agendas",
      picker,
    },
  });
  if (when.status === "missing_date") {
    return ask("Para quando?", `Para quando eu ${params.verb}? Escolha o dia e o horário.`, "o dia e a hora", DATETIME_PICKER);
  }
  if (when.status === "missing_time") {
    return ask("Que horas?", `Para ${formatAgendaDay(new Date(when.dateIso))}, que horas?`, "a hora", {
      kind: "datetime",
      mode: "time",
      suggestedIso: when.dateIso,
    });
  }
  if (when.status === "invalid_time") {
    return ask("Hora inválida", `"${when.rawTime}" não é uma hora válida. Que horas eu ${params.verb}?`, "a hora", DATETIME_PICKER);
  }
  if (when.status === "past") {
    return ask(
      "Esse horário já passou",
      `${formatAgendaDateTime(new Date(when.iso))} já passou. Para quando eu ${params.verb}?`,
      "uma data futura",
      DATETIME_PICKER,
    );
  }
  return { iso: when.iso };
}
