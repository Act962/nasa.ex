// Tempo de espera de um lead na fila do chat (spec 0121, RF-11): o texto e a faixa de cor da etiqueta.
const ATTENTION_SECONDS = 5 * 60;
const CRITICAL_SECONDS = 10 * 60;

export type WaitLevel = "ok" | "warn" | "bad";

export function waitSecondsSince(isoDate: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(isoDate).getTime()) / 1000));
}

export function formatWait(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours ? `${hours}h${pad(minutes)}` : `${pad(minutes)}:${pad(rest)}`;
}

export function waitLevel(seconds: number): WaitLevel {
  if (seconds >= CRITICAL_SECONDS) return "bad";
  return seconds >= ATTENTION_SECONDS ? "warn" : "ok";
}

export const WAIT_LEVEL_CLASS: Record<WaitLevel, string> = {
  ok: "bg-success text-black",
  warn: "bg-warning text-black",
  bad: "bg-destructive text-white",
};
