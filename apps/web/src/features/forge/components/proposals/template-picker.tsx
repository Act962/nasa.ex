"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Palette } from "lucide-react";
import { TEMPLATE_LIST, type TemplateId } from "../public/proposal-templates";

// ─── Mini preview dots (visual accent per template) ────────────────────────

const TEMPLATE_ACCENTS: Record<TemplateId, { dot: string; text: string }> = {
  modern:    { dot: "bg-[#a78bfa]",  text: "text-[#a78bfa]"  },
  clean:     { dot: "bg-gray-800",   text: "text-gray-800"   },
  corporate: { dot: "bg-blue-400",   text: "text-blue-400"   },
  bold:      { dot: "bg-yellow-400", text: "text-yellow-400" },
  premium:   { dot: "bg-amber-400",  text: "text-amber-400"  },
};

interface TemplatePickerProps {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
}

export function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Modelo da proposta
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TEMPLATE_LIST.map((tpl) => {
          const isSelected = value === tpl.id;
          const accent = TEMPLATE_ACCENTS[tpl.id];

          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onChange(tpl.id)}
              className={cn(
                "relative flex flex-col items-start gap-2 p-3 rounded-xl border-2 text-left transition-all",
                "hover:border-[#7C3AED]/40 hover:bg-muted/40",
                isSelected
                  ? "border-[#7C3AED] bg-[#7C3AED]/5 shadow-sm"
                  : "border-border bg-background"
              )}
            >
              {/* Mini preview swatch */}
              <div className={cn("w-full h-12 rounded-lg overflow-hidden flex items-end px-2 pb-2 gap-1", tpl.preview)}>
                {/* Decorative bars simulating content */}
                <div className={cn("h-1.5 rounded-full flex-1 opacity-60", accent.dot)} />
                <div className={cn("h-2.5 rounded-full w-8 opacity-80", accent.dot)} />
                <div className={cn("h-1.5 rounded-full flex-1 opacity-40", accent.dot)} />
              </div>

              {/* Label */}
              <div className="space-y-0.5 min-w-0 w-full">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold leading-tight truncate">{tpl.name}</p>
                  {isSelected && (
                    <CheckCircle2 className="size-3.5 text-[#7C3AED] shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                  {tpl.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
