"use client";

import { cn } from "@/lib/utils";
import { findBackground, findFontSize, type KpiCardStyle } from "@/features/insights/lib/kpi-card-style";

/** Desenho de um bloco de indicador nos 4 modelos; usado no painel e no relatório salvo. */

interface KpiCardShellProps {
  label: string;
  value?: string;
  sub?: string;
  icon: React.FC<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  badge?: React.ReactNode;
  cardStyle?: KpiCardStyle;
  /** Ações no canto superior direito (personalizar, ocultar). */
  actions?: React.ReactNode;
  /** Conteúdo no lugar do número (ranking, lista). */
  children?: React.ReactNode;
  className?: string;
}

export function KpiCardShell({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  badge,
  cardStyle,
  actions,
  children,
  className,
}: KpiCardShellProps) {
  const layout = cardStyle?.layout ?? "default";
  const fontSize = findFontSize(cardStyle?.fontSize);
  const background = findBackground(cardStyle?.background);
  const mutedText = background.isInverted ? "text-background/70" : "text-muted-foreground";
  const isCentered = layout === "stacked-center" || layout === "value-only";

  const iconBadge = (sizeClass: string, iconSizeClass: string) => (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full", sizeClass, iconBg)}>
      <Icon className={cn(iconSizeClass, iconColor)} />
    </div>
  );

  const body = children ? (
    <div className={cn("w-full", isCentered && "text-left")}>
      {children}
      <p className={cn("mt-2", fontSize.labelClass, mutedText)}>{label}</p>
    </div>
  ) : (
    <div className={cn("min-w-0", isCentered && "text-center")}>
      <p className={cn("font-bold leading-tight tabular-nums", fontSize.valueClass)}>{value}</p>
      <p className={cn("mt-0.5", fontSize.labelClass, mutedText)}>{label}</p>
      {sub && <p className={cn("mt-1 text-[11px] opacity-80", mutedText)}>{sub}</p>}
    </div>
  );

  return (
    <div
      className={cn(
        "group relative flex h-full w-full flex-col gap-3 rounded-xl border p-4 text-left",
        background.className,
        isCentered && "items-center justify-center",
        layout === "icon-side" && "flex-row items-center gap-4",
        className,
      )}
    >
      {actions && <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">{actions}</div>}
      {layout === "default" && (
        <div className="flex w-full items-center justify-between">
          {iconBadge("size-8", "size-4")}
          {badge}
        </div>
      )}
      {layout === "stacked-center" && iconBadge("size-12", "size-6")}
      {layout === "icon-side" && iconBadge("size-12", "size-6")}
      {body}
    </div>
  );
}
