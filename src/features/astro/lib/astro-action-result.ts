/**
 * Resultado de ação do Astro que virou cartão no chat. Sem `server-only`:
 * quem importa daqui é o renderer, no cliente.
 */

import type { AstroPicker } from "./astro-picker";

export interface AstroActionDonePayload {
  status: "done";
  title: string;
  description: string;
  publicUrl?: string;
  internalUrl?: string;
  /** Rótulo do botão, ex: "Abrir Workspace". Sem isso, "Abrir no <app>". */
  openLabel?: string;
  appName: string;
}

/** Escolha pendente: o cartão vira botões, um por opção. */
export interface AstroActionChoicePayload {
  status: "ambiguous";
  title: string;
  description: string;
  field: string;
  options: { id: string; label: string }[];
  appName: string;
  picker?: AstroPicker;
}

/** Pergunta que o cartão responde com busca ou seletor de data (spec 0033). */
export interface AstroActionPickerPayload {
  status: "needs_input" | "ambiguous";
  title: string;
  description: string;
  options?: { id: string; label: string }[];
  appName: string;
  picker: AstroPicker;
}

export function isAstroActionPickerPayload(value: unknown): value is AstroActionPickerPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AstroActionPickerPayload>;
  return (
    (candidate.status === "needs_input" || candidate.status === "ambiguous") &&
    typeof candidate.title === "string" &&
    typeof candidate.picker === "object" &&
    candidate.picker !== null
  );
}

export function isAstroActionChoicePayload(
  value: unknown,
): value is AstroActionChoicePayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AstroActionChoicePayload>;
  return (
    candidate.status === "ambiguous" &&
    Array.isArray(candidate.options) &&
    candidate.options.length > 0 &&
    typeof candidate.title === "string"
  );
}

export function isAstroActionDonePayload(
  value: unknown,
): value is AstroActionDonePayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AstroActionDonePayload>;
  return (
    candidate.status === "done" &&
    typeof candidate.title === "string" &&
    typeof candidate.description === "string"
  );
}

/** Só previsualizamos o que tem página pública para mostrar. */
export function hasPreviewablePage(
  payload: AstroActionDonePayload,
): payload is AstroActionDonePayload & { publicUrl: string } {
  return typeof payload.publicUrl === "string" && payload.publicUrl.length > 0;
}

/** A última resposta do ASTRO espera uma escolha no seletor do cartão? */
export function hasOpenPicker(
  messages: { role: string; parts?: unknown[] }[],
): boolean {
  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role !== "assistant" || !Array.isArray(lastMessage.parts)) {
    return false;
  }
  return lastMessage.parts.some((part) =>
    isAstroActionPickerPayload((part as { output?: unknown }).output),
  );
}
