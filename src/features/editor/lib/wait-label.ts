// Tempo do quadro "Esperar" escrito curto, para caber embaixo do ícone: "5 min", "1h", "15 dias".

const UNIT_LABELS: Record<string, { one: string; many: string; isGlued?: boolean }> = {
  minutes: { one: "min", many: "min" },
  hours: { one: "h", many: "h", isGlued: true },
  days: { one: "dia", many: "dias" },
  weeks: { one: "semana", many: "semanas" },
  months: { one: "mês", many: "meses" },
};

type Fields = Record<string, unknown>;

/** Quadros clássicos guardam a espera em `data.action`; os de modo agente, direto em `data`. */
export function formatWaitLabel(data: unknown): string | null {
  const fields = (data && typeof data === "object" ? data : {}) as Fields;
  const action = (fields.action && typeof fields.action === "object" ? fields.action : fields) as Fields;
  const unit = String(action.type ?? action.unit ?? "").toLowerCase();
  const unitLabel = UNIT_LABELS[unit];
  const amount = Number(action[unit]);
  if (!unitLabel || !Number.isFinite(amount) || amount <= 0) return null;
  const word = amount === 1 ? unitLabel.one : unitLabel.many;
  return unitLabel.isGlued ? `${amount}${word}` : `${amount} ${word}`;
}
