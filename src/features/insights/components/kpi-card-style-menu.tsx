"use client";

import { useState } from "react";
import { PaletteIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  KPI_CARD_BACKGROUNDS,
  KPI_CARD_FONT_SIZES,
  KPI_CARD_LAYOUTS,
  type KpiCardLayout,
  type KpiCardStyle,
} from "@/features/insights/lib/kpi-card-style";

interface KpiCardStyleMenuProps {
  label: string;
  cardStyle?: KpiCardStyle;
  onChange: (cardStyle: KpiCardStyle) => void;
  /** Aplica o patch a todos os blocos da seção. */
  onApplyToAll: (patch: KpiCardStyle) => void;
}

function LayoutPreview({ layout }: { layout: KpiCardLayout }) {
  const iconDot = <span className="size-2.5 shrink-0 rounded-full bg-info/60" />;
  const valueBar = <span className="h-1.5 w-6 rounded-full bg-foreground/70" />;
  const labelBar = <span className="h-1 w-4 rounded-full bg-foreground/30" />;
  return (
    <span
      className={cn(
        "flex h-10 w-full rounded-md border bg-card p-1.5",
        layout === "default" && "flex-col items-start justify-between",
        layout === "stacked-center" && "flex-col items-center justify-center gap-0.5",
        layout === "icon-side" && "flex-row items-center gap-1.5",
        layout === "value-only" && "flex-col items-center justify-center gap-0.5",
      )}
    >
      {layout !== "value-only" && iconDot}
      <span className={cn("flex flex-col gap-0.5", layout !== "default" && layout !== "icon-side" && "items-center")}>
        {valueBar}
        {labelBar}
      </span>
    </span>
  );
}

export function KpiCardStyleMenu({ label, cardStyle, onChange, onApplyToAll }: KpiCardStyleMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentStyle = cardStyle ?? {};
  const patchStyle = (patch: KpiCardStyle) => onChange({ ...currentStyle, ...patch });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={`Personalizar ${label}`}
          className={cn(
            "flex size-6 items-center justify-center rounded-md border bg-background/80 text-muted-foreground backdrop-blur-sm transition-opacity hover:bg-muted hover:text-foreground",
            isOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <PaletteIcon className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 space-y-4 rounded-2xl p-4"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-semibold">Personalizar bloco</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Tamanho da fonte</p>
            <button
              type="button"
              onClick={() => onApplyToAll({ fontSize: currentStyle.fontSize ?? "md" })}
              className="text-[11px] font-medium text-info hover:underline"
            >
              Aplicar a todos
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {KPI_CARD_FONT_SIZES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => patchStyle({ fontSize: option.id })}
                className={cn(
                  "h-8 rounded-full border text-xs font-medium transition-colors",
                  (currentStyle.fontSize ?? "md") === option.id
                    ? "border-transparent bg-foreground text-background"
                    : "border-line text-muted-foreground hover:bg-accent",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Cor de fundo</p>
            <button
              type="button"
              onClick={() => onApplyToAll({ background: currentStyle.background ?? "card" })}
              className="text-[11px] font-medium text-info hover:underline"
            >
              Aplicar a todos
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {KPI_CARD_BACKGROUNDS.map((option) => (
              <button
                key={option.id}
                type="button"
                title={option.label}
                aria-label={option.label}
                onClick={() => patchStyle({ background: option.id })}
                className={cn(
                  "size-7 rounded-full border",
                  option.className,
                  (currentStyle.background ?? "card") === option.id && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Modelo do bloco</p>
            <button
              type="button"
              onClick={() => onApplyToAll({ layout: currentStyle.layout ?? "default" })}
              className="text-[11px] font-medium text-info hover:underline"
            >
              Aplicar a todos
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {KPI_CARD_LAYOUTS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => patchStyle({ layout: option.id })}
                className={cn(
                  "space-y-1 rounded-xl border p-1.5 text-left transition-colors",
                  (currentStyle.layout ?? "default") === option.id ? "border-foreground" : "border-line hover:bg-accent",
                )}
              >
                <LayoutPreview layout={option.id} />
                <span className="block text-[11px] font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {(currentStyle.layout || currentStyle.fontSize || currentStyle.background) && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground"
          >
            Voltar ao padrão
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
