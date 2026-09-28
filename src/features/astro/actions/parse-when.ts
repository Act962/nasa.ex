import "server-only";

// Resolver "sexta às 15h", "amanhã 9h", "toda segunda" em data absoluta.
//
// Fica em código e não no prompt por dois motivos medidos: o classificador
// não sabe que dia é hoje, e injetar contexto temporal no prompt dele
// degradou a classificação dos outros verbos (7 falhas contra 2). Calendário
// é conta — código faz melhor, de graça e sempre igual.

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function extractTime(text: string): { hour: number; minute: number } | null {
  const withMinutes = text.match(/(\d{1,2})[:h](\d{2})/i);
  if (withMinutes) {
    return { hour: Number(withMinutes[1]), minute: Number(withMinutes[2]) };
  }
  const hourOnly = text.match(/(\d{1,2})\s*h\b/i);
  if (hourOnly) return { hour: Number(hourOnly[1]), minute: 0 };
  return null;
}

/**
 * Devolve ISO 8601 ou `null` quando a frase não traz quando. `null` vira
 * pergunta ao usuário — melhor do que inventar um horário.
 */
export function parseWhen(text: string, now = new Date()): string | null {
  const normalized = stripAccents(text.toLowerCase());
  const time = extractTime(normalized);

  // ISO já pronto passa direto.
  const iso = text.match(/\d{4}-\d{2}-\d{2}(T[\d:.+-]+)?/);
  if (iso) {
    const parsed = new Date(iso[0]);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const target = new Date(now);
  target.setSeconds(0, 0);
  if (time) target.setHours(time.hour, time.minute);

  if (/\bamanha\b/.test(normalized)) {
    target.setDate(target.getDate() + 1);
    return target.toISOString();
  }
  if (/\bhoje\b/.test(normalized)) return target.toISOString();

  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    if (!new RegExp(`\\b${stripAccents(name)}\\b`).test(normalized)) continue;
    // Próxima ocorrência do dia da semana; "sexta" dita numa sexta significa
    // a que vem, não hoje.
    const delta = (weekday - target.getDay() + 7) % 7 || 7;
    target.setDate(target.getDate() + delta);
    return target.toISOString();
  }

  // Só horário, sem dia: é hoje se ainda não passou, senão amanhã.
  if (time) {
    if (target <= now) target.setDate(target.getDate() + 1);
    return target.toISOString();
  }

  return null;
}
