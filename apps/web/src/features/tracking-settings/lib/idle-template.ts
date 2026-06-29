export interface IdleTemplateContext {
  lead: {
    name?: string | null;
    phone?: string | null;
    amount?: number | string | { toString(): string } | null;
    email?: string | null;
  };
  minutesWaiting: number;
}

export const IDLE_TEMPLATE_PLACEHOLDERS = [
  { token: "{lead.name}", description: "Nome do lead" },
  { token: "{lead.phone}", description: "Telefone do lead" },
  { token: "{lead.amount}", description: "Valor do lead" },
  { token: "{lead.email}", description: "Email do lead" },
  { token: "{minutesWaiting}", description: "Minutos desde a última interação" },
] as const;

export function renderIdleTemplate(
  template: string,
  ctx: IdleTemplateContext,
): string {
  const map: Record<string, string> = {
    "{lead.name}": ctx.lead.name ?? "",
    "{lead.phone}": ctx.lead.phone ?? "",
    "{lead.amount}":
      ctx.lead.amount != null ? String(ctx.lead.amount.toString()) : "",
    "{lead.email}": ctx.lead.email ?? "",
    "{minutesWaiting}": String(ctx.minutesWaiting),
  };

  return template.replace(
    /\{lead\.(name|phone|amount|email)\}|\{minutesWaiting\}/g,
    (match) => map[match] ?? match,
  );
}
