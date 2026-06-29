/**
 * Mascote da barra de progresso do formulário.
 * Lista padrão (mockada) usada quando o form não tem configuração própria.
 * Cada bloco do form tem progressMascots em settings.progressMascots (JSON).
 */
export type ProgressMascot = {
  min: number;
  max: number;
  label: string;
  emoji?: string;
  imageUrl?: string; // S3 key (sem prefixo de domínio)
};

export const DEFAULT_PROGRESS_MASCOTS: ProgressMascot[] = [
  { min: 0, max: 9, emoji: "🌱", label: "Começando" },
  { min: 10, max: 24, emoji: "🚶", label: "Caminhando" },
  { min: 25, max: 49, emoji: "🏃", label: "Acelerando" },
  { min: 50, max: 74, emoji: "🚴", label: "Pegando ritmo" },
  { min: 75, max: 89, emoji: "🚀", label: "Quase lá" },
  { min: 90, max: 99, emoji: "⭐", label: "Faltando pouco" },
  { min: 100, max: 100, emoji: "🏆", label: "Concluído!" },
];

/**
 * Resolve a lista de mascotes a usar pra um form. Se a configuração custom
 * estiver vazia ou inválida, cai no default.
 */
export function resolveProgressMascots(
  raw: unknown,
): ProgressMascot[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_PROGRESS_MASCOTS;
  const valid = raw.filter(
    (m): m is ProgressMascot =>
      m && typeof m === "object" && typeof (m as { min?: number }).min === "number" &&
      typeof (m as { max?: number }).max === "number",
  );
  return valid.length > 0 ? valid : DEFAULT_PROGRESS_MASCOTS;
}

export function getCurrentMascot(
  list: ProgressMascot[],
  pct: number,
): ProgressMascot {
  return (
    list.find((m) => pct >= m.min && pct <= m.max) ?? list[0]
  );
}
