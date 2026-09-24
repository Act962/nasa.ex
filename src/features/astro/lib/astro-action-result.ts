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
