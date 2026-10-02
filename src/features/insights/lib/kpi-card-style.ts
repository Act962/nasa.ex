import { z } from "zod";

/** Aparência de cada bloco de indicador do Insights, salva por empresa junto da ordem da seção. */

export const KPI_CARD_LAYOUT_IDS = ["default", "stacked-center", "icon-side", "value-only"] as const;
export const KPI_CARD_FONT_SIZE_IDS = ["md", "lg", "xl", "2xl"] as const;
export const KPI_CARD_BACKGROUND_IDS = ["card", "info", "success", "warning", "destructive", "violet", "dark"] as const;

export type KpiCardLayout = (typeof KPI_CARD_LAYOUT_IDS)[number];
export type KpiCardFontSize = (typeof KPI_CARD_FONT_SIZE_IDS)[number];
export type KpiCardBackground = (typeof KPI_CARD_BACKGROUND_IDS)[number];

export const kpiCardStyleSchema = z.object({
  layout: z.enum(KPI_CARD_LAYOUT_IDS).optional(),
  fontSize: z.enum(KPI_CARD_FONT_SIZE_IDS).optional(),
  background: z.enum(KPI_CARD_BACKGROUND_IDS).optional(),
});

export type KpiCardStyle = z.infer<typeof kpiCardStyleSchema>;

export const KPI_CARD_LAYOUTS: Array<{ id: KpiCardLayout; label: string }> = [
  { id: "default", label: "Padrão" },
  { id: "stacked-center", label: "Ícone em cima" },
  { id: "icon-side", label: "Ícone ao lado" },
  { id: "value-only", label: "Só o valor" },
];

export const KPI_CARD_FONT_SIZES: Array<{ id: KpiCardFontSize; label: string; valueClass: string; labelClass: string }> = [
  { id: "md", label: "P", valueClass: "text-2xl", labelClass: "text-xs" },
  { id: "lg", label: "M", valueClass: "text-3xl", labelClass: "text-sm" },
  { id: "xl", label: "G", valueClass: "text-4xl", labelClass: "text-sm" },
  { id: "2xl", label: "GG", valueClass: "text-5xl", labelClass: "text-base" },
];

export const KPI_CARD_BACKGROUNDS: Array<{ id: KpiCardBackground; label: string; className: string; isInverted?: boolean }> = [
  { id: "card", label: "Branco", className: "bg-card" },
  { id: "info", label: "Azul", className: "bg-info/10" },
  { id: "success", label: "Verde", className: "bg-success/10" },
  { id: "warning", label: "Amarelo", className: "bg-warning/15" },
  { id: "destructive", label: "Vermelho", className: "bg-destructive/10" },
  { id: "violet", label: "Lilás", className: "bg-chart-4/15" },
  { id: "dark", label: "Escuro", className: "bg-foreground text-background", isInverted: true },
];

export function findFontSize(fontSize?: KpiCardFontSize) {
  return KPI_CARD_FONT_SIZES.find((option) => option.id === fontSize) ?? KPI_CARD_FONT_SIZES[0];
}

export function findBackground(background?: KpiCardBackground) {
  return KPI_CARD_BACKGROUNDS.find((option) => option.id === background) ?? KPI_CARD_BACKGROUNDS[0];
}
