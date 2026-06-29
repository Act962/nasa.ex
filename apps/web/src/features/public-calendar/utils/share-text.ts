import dayjs from "dayjs";
import "dayjs/locale/pt-br";

export type SharePlatform = "whatsapp" | "x" | "facebook" | "linkedin" | "copy" | "google" | "ics";

export interface ShareEvent {
  title: string;
  startDate: Date | string;
  city?: string | null;
  state?: string | null;
  description?: string | null;
  endDate?: Date | string | null;
}

export function buildShareText(event: ShareEvent, shortUrl: string): string {
  const when = dayjs(event.startDate).locale("pt-br").format("DD [de] MMMM [às] HH:mm");
  const place =
    [event.city, event.state].filter(Boolean).join("/") || "online";
  return [
    `🚀 ${event.title}`,
    `📅 ${when}`,
    `📍 ${place}`,
    ``,
    `Ver detalhes: ${shortUrl}`,
  ].join("\n");
}

export function buildShareUrl(platform: SharePlatform, text: string, url: string): string {
  switch (platform) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${text}`)}`;
    case "x":
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    default:
      return url;
  }
}

function fmtGoogleDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    "00Z"
  );
}

export function buildGoogleCalendarUrl(event: ShareEvent, url: string): string {
  const start = new Date(event.startDate);
  const end = event.endDate
    ? new Date(event.endDate)
    : new Date(start.getTime() + 60 * 60 * 1000);
  const place = [event.city, event.state].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${fmtGoogleDate(start)}/${fmtGoogleDate(end)}`,
    details: `${event.description ?? ""}\n\n${url}`.trim(),
    location: place,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}
