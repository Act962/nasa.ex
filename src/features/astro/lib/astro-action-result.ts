/**
 * Resultado de ação do Astro que virou cartão no chat. Sem `server-only`:
 * quem importa daqui é o renderer, no cliente.
 */

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
