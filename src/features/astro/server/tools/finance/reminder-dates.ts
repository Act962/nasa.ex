import "server-only";
import { todayIsoInSaoPaulo } from "./dates";

// Data e hora de lembrete no fuso de São Paulo (sem horário de verão desde 2019).

const SAO_PAULO_OFFSET = "-03:00";
const DEFAULT_REMINDER_TIME = "09:00";
const PAST_TOLERANCE_MS = 60_000;

const RELATIVE_DAY_PATTERN = /^(hoje|amanh[ãa]|today|tomorrow)(?:\s+(?:às\s+|as\s+)?(\d{1,2})(?:[:h](\d{2}))?h?)?$/;
const LOCAL_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?(?::\d{2}(?:\.\d+)?)?$/;
const EXPLICIT_OFFSET_PATTERN = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

function tomorrowIsoInSaoPaulo(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 10);
}

function composeSaoPauloDate(dateIso: string, time: string): Date {
  return new Date(`${dateIso}T${time}:00${SAO_PAULO_OFFSET}`);
}

function toTime(hour: string | undefined, minute: string | undefined): string {
  if (!hour) return DEFAULT_REMINDER_TIME;
  return `${hour.padStart(2, "0")}:${(minute ?? "00").padStart(2, "0")}`;
}

export function resolveReminderDateTime(value: string): Date | { error: string } {
  const normalized = value.trim().toLowerCase();
  let resolved: Date | null = null;

  const relativeMatch = normalized.match(RELATIVE_DAY_PATTERN);
  const localMatch = normalized.match(LOCAL_DATE_TIME_PATTERN);

  if (relativeMatch) {
    const isToday = relativeMatch[1] === "hoje" || relativeMatch[1] === "today";
    const dateIso = isToday ? todayIsoInSaoPaulo() : tomorrowIsoInSaoPaulo();
    resolved = composeSaoPauloDate(dateIso, toTime(relativeMatch[2], relativeMatch[3]));
  } else if (EXPLICIT_OFFSET_PATTERN.test(value.trim())) {
    resolved = new Date(value.trim());
  } else if (localMatch) {
    resolved = composeSaoPauloDate(localMatch[1], toTime(localMatch[2], localMatch[3]));
  }

  if (!resolved || Number.isNaN(resolved.getTime())) {
    return { error: `Data/hora inválida: "${value}". Use AAAA-MM-DDTHH:mm (horário de Brasília), 'hoje 14:00' ou 'amanhã'.` };
  }
  if (resolved.getTime() < Date.now() - PAST_TOLERANCE_MS) {
    return { error: "Esse horário já passou. Peça outra data/hora ao usuário." };
  }
  return resolved;
}

export function formatReminderDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}
