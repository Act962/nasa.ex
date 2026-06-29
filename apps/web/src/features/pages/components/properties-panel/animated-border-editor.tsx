"use client";

/**
 * Editor da "borda animada" — efeito Explorer reusável em qualquer
 * element do NASA Pages.
 *
 * Toggle on/off + paleta editável (presets + custom) + velocidade +
 * espessura + raio. Quando o toggle está off, todas as outras opções
 * ficam disabled visualmente mas o JSON mantém as últimas escolhas
 * (não perde config quando desliga e religa).
 */
import { Sparkles, RotateCcw, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ElementBase } from "../../types";
import { EXPLORER_GRADIENT_COLORS } from "../elements/animated-border";

/**
 * Paletas pré-feitas — primeiro é a EXACT do NASA Explorer no /home.
 * Outras são variações populares (azul-ciano, verde-esmeralda, fogo).
 * Click no preset substitui o array completo de cores.
 */
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
    label: "Monocromático",
    colors: ["#52525b", "#a1a1aa", "rgba(255,255,255,0.92)", "#a1a1aa", "#52525b"],
    preview: "linear-gradient(270deg, #52525b, #a1a1aa, #fff, #a1a1aa, #52525b)",
  },
] as const;

interface Props {
  el: ElementBase;
  update: (patch: Partial<ElementBase>) => void;
}

export function AnimatedBorderEditor({ el, update }: Props) {
  const enabled = (el.animatedBorder as boolean | undefined) ?? false;
  const colors =
    (el.animatedBorderColors as string[] | undefined) ??
    [...EXPLORER_GRADIENT_COLORS];
  const width = (el.animatedBorderWidth as number | undefined) ?? 1.5;
  const speed = (el.animatedBorderSpeed as number | undefined) ?? 5;
  const radius = (el.animatedBorderRadius as number | undefined) ?? 16;

  const setColor = (idx: number, color: string) => {
    const next = [...colors];
    next[idx] = color;
    update({ animatedBorderColors: next });
  };
  const addColor = () =>
    update({ animatedBorderColors: [...colors, "#ffffff"] });
  const removeColor = (idx: number) =>
    update({
      animatedBorderColors: colors.filter((_, i) => i !== idx),
    });

  const liveGradient = `linear-gradient(270deg, ${colors.join(", ")})`;

  return (
    <div className="mb-2">
      {/* Toggle principal */}
      <div className="flex items-center justify-between rounded-md border px-2 py-1.5 bg-muted/20">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="size-3.5 text-indigo-500 shrink-0" />
          <span className="text-[11px] font-medium truncate">
            Borda animada
          </span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => update({ animatedBorder: checked })}
        />
      </div>

      {/* Quando desligado, mostramos só a preview tênue + dica */}
      {!enabled ? (
        <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug px-1">
          Adiciona uma borda com gradiente colorido em movimento ao redor do
          elemento — estilo NASA Explorer.
        </p>
      ) : (
        <div className="mt-2 border rounded-md p-2 bg-muted/10 space-y-2.5">
          {/* Preview do gradiente */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Pré-visualização</Label>
            <div
              className="h-7 rounded-md mt-1 nasa-anim-border"
              style={{
                ["--nasa-anim-border-gradient" as string]: liveGradient,
                ["--nasa-anim-border-speed" as string]: `${speed}s`,
                ["--nasa-anim-border-radius" as string]: `${radius}px`,
                padding: width,
              }}
            >
              <div
                style={{
                  background: "var(--background, #0f172a)",
                  borderRadius: Math.max(0, radius - width),
                  height: "100%",
                  width: "100%",
                }}
              />
            </div>
          </div>

          {/* Presets */}
          <div>
            <Label className="text-[10px] text-muted-foreground">
              Paletas prontas
            </Label>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    update({ animatedBorderColors: [...preset.colors] })
                  }
                  className={cn(
                    "border rounded-md p-1 hover:border-indigo-400 transition-colors text-left",
                    JSON.stringify(colors) === JSON.stringify(preset.colors) &&
                      "border-indigo-500 ring-1 ring-indigo-300",
                  )}
                >
                  <div
                    className="h-3 rounded-sm mb-1"
                    style={{ background: preset.preview }}
                  />
                  <span className="text-[9px] text-muted-foreground truncate block">
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor individual das cores */}
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
                <Plus className="size-2.5" /> Cor
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {colors.map((color, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-0.5 border rounded p-0.5 bg-background"
                >
                  <input
                    type="color"
                    value={color.startsWith("rgba") ? "#ffffff" : color}
                    onChange={(e) => setColor(idx, e.target.value)}
                    className="size-5 rounded cursor-pointer p-0 border-0 bg-transparent"
                    title={color}
                  />
                  {colors.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeColor(idx)}
                      className="size-3.5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Remover"
                    >
                      <X className="size-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Velocidade / espessura / raio */}
          <div className="grid grid-cols-3 gap-2">
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
                  update({ animatedBorderSpeed: Number(e.target.value) })
                }
                className="text-[11px] h-7"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Borda (px)
              </Label>
              <Input
                type="number"
                min={0.5}
                max={20}
                step={0.5}
                value={width}
                onChange={(e) =>
                  update({ animatedBorderWidth: Number(e.target.value) })
                }
                className="text-[11px] h-7"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Raio</Label>
              <Input
                type="number"
                min={0}
                max={64}
                value={radius}
                onChange={(e) =>
                  update({ animatedBorderRadius: Number(e.target.value) })
                }
                className="text-[11px] h-7"
              />
            </div>
          </div>

          {/* Reset pros defaults do Explorer */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              update({
                animatedBorderColors: [...EXPLORER_GRADIENT_COLORS],
                animatedBorderWidth: 1.5,
                animatedBorderSpeed: 5,
                animatedBorderRadius: 16,
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
