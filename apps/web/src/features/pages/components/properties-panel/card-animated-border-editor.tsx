"use client";

/**
 * Editor compacto da "borda animada nos cards" — versão simplificada
 * do `AnimatedBorderEditor` específica pras sections compostas.
 *
 * Escreve em props prefixadas com `card*` (cardAnimatedBorder, etc) pra
 * não colidir com a borda animada GLOBAL do elemento. Quando ligado, o
 * renderer envolve cada card individual com `<AnimatedBorder>`.
 *
 * Defaults igualam-se ao Explorer (mesma paleta do /home).
 */
import { Sparkles, RotateCcw, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EXPLORER_GRADIENT_COLORS } from "../elements/animated-border";
import type { ElementBase } from "../../types";

const PRESETS = [
  {
    id: "explorer",
    label: "NASA Explorer",
    colors: [...EXPLORER_GRADIENT_COLORS],
    preview: "linear-gradient(270deg, #7C3AED, #a855f7, #EC4899, #fff)",
  },
  {
    id: "ocean",
    label: "Oceano",
    colors: ["#0ea5e9", "#06b6d4", "#10b981", "rgba(255,255,255,0.92)"],
    preview: "linear-gradient(270deg, #0ea5e9, #06b6d4, #10b981, #fff)",
  },
  {
    id: "fire",
    label: "Fogo",
    colors: ["#ef4444", "#f97316", "#eab308", "rgba(255,255,255,0.92)"],
    preview: "linear-gradient(270deg, #ef4444, #f97316, #eab308, #fff)",
  },
  {
    id: "mono",
    label: "Mono",
    colors: ["#52525b", "#a1a1aa", "rgba(255,255,255,0.92)", "#a1a1aa", "#52525b"],
    preview: "linear-gradient(270deg, #52525b, #a1a1aa, #fff, #a1a1aa, #52525b)",
  },
] as const;

interface Props {
  el: ElementBase;
  update: (patch: Partial<ElementBase>) => void;
}

export function CardAnimatedBorderEditor({ el, update }: Props) {
  const enabled = (el.cardAnimatedBorder as boolean | undefined) ?? false;
  const colors =
    (el.cardAnimatedBorderColors as string[] | undefined) ??
    [...EXPLORER_GRADIENT_COLORS];
  const width = (el.cardAnimatedBorderWidth as number | undefined) ?? 1.5;
  const speed = (el.cardAnimatedBorderSpeed as number | undefined) ?? 5;

  const setColor = (idx: number, color: string) => {
    const next = [...colors];
    next[idx] = color;
    update({ cardAnimatedBorderColors: next });
  };
  const addColor = () =>
    update({ cardAnimatedBorderColors: [...colors, "#ffffff"] });
  const removeColor = (idx: number) =>
    update({
      cardAnimatedBorderColors: colors.filter((_, i) => i !== idx),
    });

  const liveGradient = `linear-gradient(270deg, ${colors.join(", ")})`;

  return (
    <div className="mt-2 mb-2">
      <div className="flex items-center justify-between rounded-md border px-2 py-1.5 bg-muted/20">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="size-3.5 text-indigo-500 shrink-0" />
          <span className="text-[11px] font-medium truncate">
            Borda animada nos cards
          </span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) =>
            update({ cardAnimatedBorder: checked })
          }
        />
      </div>

      {!enabled ? (
        <p className="text-[10px] text-muted-foreground mt-1 px-1 leading-snug">
          Aplica o efeito gradient deslizante em volta de cada card
          individualmente (depoimento, plano, FAQ).
        </p>
      ) : (
        <div className="mt-1.5 border rounded-md p-2 bg-muted/10 space-y-2">
          {/* Preview */}
          <div>
            <Label className="text-[10px] text-muted-foreground">
              Pré-visualização
            </Label>
            <div
              className="h-6 rounded-md mt-1 nasa-anim-border"
              style={{
                ["--nasa-anim-border-gradient" as string]: liveGradient,
                ["--nasa-anim-border-speed" as string]: `${speed}s`,
                ["--nasa-anim-border-radius" as string]: "8px",
                padding: width,
              }}
            >
              <div
                style={{
                  background: "var(--background, #0f172a)",
                  borderRadius: Math.max(0, 8 - width),
                  height: "100%",
                  width: "100%",
                }}
              />
            </div>
          </div>

          {/* Presets */}
          <div>
            <Label className="text-[10px] text-muted-foreground">
              Paleta
            </Label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    update({ cardAnimatedBorderColors: [...preset.colors] })
                  }
                  className={cn(
                    "border rounded-md p-0.5 hover:border-indigo-400 transition-colors text-left",
                    JSON.stringify(colors) === JSON.stringify(preset.colors) &&
                      "border-indigo-500 ring-1 ring-indigo-300",
                  )}
                  title={preset.label}
                >
                  <div
                    className="h-2.5 rounded-sm"
                    style={{ background: preset.preview }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Cores individuais */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] text-muted-foreground">
                Cores ({colors.length})
              </Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={addColor}
                className="h-5 px-1 text-[10px] gap-0.5"
                disabled={colors.length >= 10}
              >
                <Plus className="size-2.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-0.5">
              {colors.map((color, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-0.5 border rounded p-0.5 bg-background"
                >
                  <input
                    type="color"
                    value={color.startsWith("rgba") ? "#ffffff" : color}
                    onChange={(e) => setColor(idx, e.target.value)}
                    className="size-4 rounded cursor-pointer p-0 border-0 bg-transparent"
                    title={color}
                  />
                  {colors.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeColor(idx)}
                      className="size-3 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-2" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Veloc + largura */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Veloc. (s)
              </Label>
              <Input
                type="number"
                min={1}
                max={30}
                step={0.5}
                value={speed}
                onChange={(e) =>
                  update({ cardAnimatedBorderSpeed: Number(e.target.value) })
                }
                className="text-[11px] h-7"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Largura (px)
              </Label>
              <Input
                type="number"
                min={0.5}
                max={20}
                step={0.5}
                value={width}
                onChange={(e) =>
                  update({ cardAnimatedBorderWidth: Number(e.target.value) })
                }
                className="text-[11px] h-7"
              />
            </div>
          </div>

          {/* Reset */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              update({
                cardAnimatedBorderColors: [...EXPLORER_GRADIENT_COLORS],
                cardAnimatedBorderWidth: 1.5,
                cardAnimatedBorderSpeed: 5,
              })
            }
            className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" /> Restaurar Explorer
          </Button>
        </div>
      )}
    </div>
  );
}
