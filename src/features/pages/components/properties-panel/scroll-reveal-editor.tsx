"use client";

/**
 * Editor do efeito "scroll reveal" — entrada/saída suave ao scrollar.
 *
 * Toggle on/off + escolha do preset (fade/slide/zoom/blur) + distância
 * + duração + delay + threshold + opção de "repetir a cada entrada"
 * (replay) ou animar 1x e fixar.
 *
 * O JSON mantém as últimas escolhas mesmo com toggle off — não perde
 * config ao desligar/religar.
 */
import {
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ZoomIn, ZoomOut, RotateCcw, MoveDiagonal, Wind, Sparkle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ElementBase } from "../../types";
import type { ScrollRevealPreset } from "../elements/scroll-reveal";

const PRESETS: Array<{
  id: ScrollRevealPreset;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "slide-up",    label: "Sobe",      icon: ArrowUp },
  { id: "slide-down",  label: "Desce",     icon: ArrowDown },
  { id: "slide-left",  label: "Esquerda",  icon: ArrowLeft },
  { id: "slide-right", label: "Direita",   icon: ArrowRight },
  { id: "fade",        label: "Fade",      icon: MoveDiagonal },
  { id: "zoom-in",     label: "Zoom in",   icon: ZoomIn },
  { id: "zoom-out",    label: "Zoom out",  icon: ZoomOut },
  { id: "blur",        label: "Blur",      icon: Wind },
];

interface Props {
  el: ElementBase;
  update: (patch: Partial<ElementBase>) => void;
}

export function ScrollRevealEditor({ el, update }: Props) {
  const enabled = (el.scrollReveal as boolean | undefined) ?? false;
  const preset = (el.scrollRevealPreset as ScrollRevealPreset | undefined) ?? "slide-up";
  const distance = (el.scrollRevealDistance as number | undefined) ?? 32;
  const durationMs = (el.scrollRevealDurationMs as number | undefined) ?? 700;
  const delayMs = (el.scrollRevealDelayMs as number | undefined) ?? 0;
  const threshold = (el.scrollRevealThreshold as number | undefined) ?? 0.15;
  const replay = (el.scrollRevealReplay as boolean | undefined) ?? true;

  return (
    <div className="mb-2">
      {/* Toggle principal */}
      <div className="flex items-center justify-between rounded-md border px-2 py-1.5 bg-muted/20">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkle className="size-3.5 text-emerald-500 shrink-0" />
          <span className="text-[11px] font-medium truncate">
            Animação ao scrollar
          </span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => update({ scrollReveal: checked })}
        />
      </div>

      {!enabled ? (
        <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug px-1">
          Aplica um movimento suave de entrada quando o elemento aparece
          ao rolar a página — quebra o estático sem ser intrusivo.
        </p>
      ) : (
        <div className="mt-2 border rounded-md p-2 bg-muted/10 space-y-2.5">
          {/* Preset chips */}
          <div>
            <Label className="text-[10px] text-muted-foreground">
              Efeito
            </Label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {PRESETS.map((opt) => {
                const Icon = opt.icon;
                const active = preset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update({ scrollRevealPreset: opt.id })}
                    className={cn(
                      "border rounded-md p-1.5 transition-colors flex flex-col items-center gap-0.5",
                      active
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-background border-border hover:bg-accent text-muted-foreground",
                    )}
                    title={opt.label}
                  >
                    <Icon className="size-3.5" />
                    <span className="text-[9px] leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Distância (escondida pra fade/zoom/blur, que não usam) */}
          {(preset === "slide-up" ||
            preset === "slide-down" ||
            preset === "slide-left" ||
            preset === "slide-right") && (
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Distância (px)
              </Label>
              <Input
                type="number"
                min={4}
                max={400}
                value={distance}
                onChange={(e) =>
                  update({ scrollRevealDistance: Number(e.target.value) })
                }
                className="text-[11px] h-7"
              />
            </div>
          )}

          {/* Duração / delay */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Duração (ms)
              </Label>
              <Input
                type="number"
                min={100}
                max={3000}
                step={50}
                value={durationMs}
                onChange={(e) =>
                  update({ scrollRevealDurationMs: Number(e.target.value) })
                }
                className="text-[11px] h-7"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Atraso (ms)
              </Label>
              <Input
                type="number"
                min={0}
                max={3000}
                step={50}
                value={delayMs}
                onChange={(e) =>
                  update({ scrollRevealDelayMs: Number(e.target.value) })
                }
                className="text-[11px] h-7"
              />
            </div>
          </div>

          {/* Threshold */}
          <div>
            <Label className="text-[10px] text-muted-foreground">
              Disparar quando {Math.round(threshold * 100)}% estiver visível
            </Label>
            <input
              type="range"
              min={5}
              max={90}
              step={5}
              value={Math.round(threshold * 100)}
              onChange={(e) =>
                update({
                  scrollRevealThreshold: Number(e.target.value) / 100,
                })
              }
              className="w-full mt-1 accent-indigo-500"
            />
          </div>

          {/* Replay toggle */}
          <div className="flex items-center justify-between border rounded-md px-2 py-1.5 bg-background">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-medium">
                Repetir ao reentrar
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                {replay
                  ? "Volta ao estado inicial quando sair da tela"
                  : "Anima 1x e mantém visível"}
              </span>
            </div>
            <Switch
              checked={replay}
              onCheckedChange={(checked) =>
                update({ scrollRevealReplay: checked })
              }
            />
          </div>

          {/* Reset */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              update({
                scrollRevealPreset: "slide-up",
                scrollRevealDistance: 32,
                scrollRevealDurationMs: 700,
                scrollRevealDelayMs: 0,
                scrollRevealThreshold: 0.15,
                scrollRevealReplay: true,
              })
            }
            className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" /> Restaurar padrão
          </Button>
        </div>
      )}
    </div>
  );
}
