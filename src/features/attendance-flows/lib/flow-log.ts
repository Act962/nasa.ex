// Log de uma linha do FlowAstro (spec 0139): `[flowastro] <evento> chave=valor ...`. Filtre o terminal por "[flowastro]"
// para seguir um lead do começo ao fim do fluxo.

type LogValue = string | number | boolean | null | undefined;

function formatValue(value: LogValue): string {
  const text = String(value);
  return /\s/.test(text) ? JSON.stringify(text) : text;
}

export function flowLog(event: string, fields: Record<string, LogValue> = {}): void {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${formatValue(value)}`);
  console.log(`[flowastro] ${event}${parts.length ? ` ${parts.join(" ")}` : ""}`);
}

export function flowLogError(event: string, error: unknown, fields: Record<string, LogValue> = {}): void {
  flowLog(event, { ...fields, error: error instanceof Error ? error.message : String(error) });
  console.error(error);
}

/** Texto da mensagem cortado para caber na linha do log. */
export function previewText(text: unknown, maxLength = 60): string {
  const value = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}
