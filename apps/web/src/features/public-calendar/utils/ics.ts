function formatIcsDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string | null;
  startDate: Date;
  endDate?: Date | null;
  location?: string | null;
  url?: string | null;
}

export function buildIcs(event: IcsEvent): string {
  const dtStart = formatIcsDate(event.startDate);
  const dtEnd = formatIcsDate(
    event.endDate ?? new Date(event.startDate.getTime() + 60 * 60 * 1000),
  );
  const now = formatIcsDate(new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NASA.ex//Calendario Publico//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}@nasaex.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
