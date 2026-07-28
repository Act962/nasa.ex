/**
 * Config de "gerar Actions a partir do formulário", persistida como JSON tipado
 * em `FormSettings.generateActionsConfig`. Espelha o padrão dos outros campos
 * JSON das settings (`nextButtonAction`, `progressMascots`): tipo forte em TS +
 * `Json` no banco + normalizador defensivo lido do `Prisma.JsonValue`.
 *
 * v1: 1 template → 1 action por envio (objeto único `template`). A união
 * discriminada de preset/token deixa espaço p/ evoluir (multi-template,
 * `from_field` no vencimento) sem quebrar dados existentes.
 */

/** Token do título: campo do form (resolvido pelo id do bloco) ou texto literal. */
export type TitleToken =
  | { type: "field"; blockId: string }
  | { type: "literal"; text: string };

/** Preset relativo ao horário do envio p/ o vencimento (dueDate) da action. */
export type DueDatePreset =
  | { preset: "today" }
  | { preset: "tomorrow" }
  | { preset: "in_days"; days: number }
  | { preset: "end_of_week" };

export type ActionTemplate = {
  title: TitleToken[];
  /** null → 1º workspace conectado ao tracking do form. */
  workspaceId: string | null;
  /** null → 1ª coluna do workspace resolvido. */
  columnId: string | null;
  /** Campo ImageUpload usado como capa; `index` escolhe a imagem (0 = single). */
  coverImage: { blockId: string; index: number } | null;
  dueDate: DueDatePreset | null;
};

export type GenerateActionsConfig = {
  enabled: boolean;
  template: ActionTemplate | null;
};

export const EMPTY_ACTION_TEMPLATE: ActionTemplate = {
  title: [],
  workspaceId: null,
  columnId: null,
  coverImage: null,
  dueDate: null,
};

export const DISABLED_GENERATE_ACTIONS_CONFIG: GenerateActionsConfig = {
  enabled: false,
  template: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTitle(raw: unknown): TitleToken[] {
  if (!Array.isArray(raw)) return [];
  const tokens: TitleToken[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (item.type === "field" && typeof item.blockId === "string") {
      tokens.push({ type: "field", blockId: item.blockId });
    } else if (item.type === "literal" && typeof item.text === "string") {
      tokens.push({ type: "literal", text: item.text });
    }
  }
  return tokens;
}

function normalizeDueDate(raw: unknown): DueDatePreset | null {
  if (!isRecord(raw)) return null;
  switch (raw.preset) {
    case "today":
      return { preset: "today" };
    case "tomorrow":
      return { preset: "tomorrow" };
    case "end_of_week":
      return { preset: "end_of_week" };
    case "in_days": {
      const days = typeof raw.days === "number" ? Math.trunc(raw.days) : NaN;
      if (!Number.isFinite(days) || days < 0) return null;
      return { preset: "in_days", days: Math.min(days, 365) };
    }
    default:
      return null;
  }
}

function normalizeCoverImage(
  raw: unknown,
): { blockId: string; index: number } | null {
  if (!isRecord(raw) || typeof raw.blockId !== "string") return null;
  const index = typeof raw.index === "number" ? Math.trunc(raw.index) : 0;
  return { blockId: raw.blockId, index: index >= 0 ? index : 0 };
}

function normalizeTemplate(raw: unknown): ActionTemplate | null {
  if (!isRecord(raw)) return null;
  return {
    title: normalizeTitle(raw.title),
    workspaceId: typeof raw.workspaceId === "string" ? raw.workspaceId : null,
    columnId: typeof raw.columnId === "string" ? raw.columnId : null,
    coverImage: normalizeCoverImage(raw.coverImage),
    dueDate: normalizeDueDate(raw.dueDate),
  };
}

/**
 * Lê o `Prisma.JsonValue` (ou qualquer coisa) e devolve um `GenerateActionsConfig`
 * sempre válido. Ausente/malformado → config desabilitada.
 */
export function resolveGenerateActionsConfig(
  raw: unknown,
): GenerateActionsConfig {
  if (!isRecord(raw)) return DISABLED_GENERATE_ACTIONS_CONFIG;
  return {
    enabled: raw.enabled === true,
    template: normalizeTemplate(raw.template),
  };
}
