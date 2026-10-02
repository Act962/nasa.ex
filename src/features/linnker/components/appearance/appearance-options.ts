import type { LinnkerButtonStyle } from "../../types";

/** Cores sugeridas para a página pública do cliente (conteúdo dele, não tema da plataforma). */
export const PRESET_COVER_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#64748b", "#1e293b", "#0f172a",
];

export const PRESET_BACKGROUND_COLORS = [
  "#f3f4f6", "#ffffff", "#0f172a", "#1e293b", "#fef9c3",
  "#fce7f3", "#ede9fe", "#dcfce7", "#dbeafe",
];

export const PRESET_SOCIAL_ICON_COLORS = [
  "#52525b", "#ffffff", "#000000", "#6366f1", "#ec4899", "#22c55e", "#f97316",
];

export const BUTTON_STYLES: { value: LinnkerButtonStyle; label: string; previewClassName: string }[] = [
  { value: "pill", label: "Redondo", previewClassName: "rounded-full" },
  { value: "rounded", label: "Arredondado", previewClassName: "rounded-lg" },
  { value: "sharp", label: "Reto", previewClassName: "rounded-none" },
];
