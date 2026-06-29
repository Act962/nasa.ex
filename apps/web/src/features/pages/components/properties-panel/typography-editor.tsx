"use client";

/**
 * Editor compacto de tipografia — usado dentro das sections compostas
 * pra customizar cor/tamanho/fonte/peso/alinhamento/itálico de cada
 * texto interno individualmente.
 *
 * UX:
 *   - Quando colapsado, mostra resumo "Aa 16px Inter 600" pra dar
 *     contexto rápido. Click expande controles completos.
 *   - Todos os campos são opcionais — vazio = herda do nível acima
 *     (section → defaults).
 *   - Botão "Resetar" volta tudo pra undefined (herda defaults).
 *
 * Hierarquia de overrides:
 *   default (renderer) → section-level (element[style]) → card-level
 *   (item[style]). O `level` prop define em qual camada estamos
 *   editando — muda só o label do header.
 */
import { useState } from "react";
import {
  ChevronDown, ChevronRight, RotateCcw, Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  type TextStyle,
  COMMON_FONTS,
  FONT_WEIGHTS,
} from "../../lib/text-style";
import { usePagesBuilderStore } from "../../context/pages-builder-store";

interface Props {
  label: string;
  /** Estilo atual; undefined = nenhum override. */
  value: TextStyle | undefined;
  onChange: (next: TextStyle | undefined) => void;
  /** Pra mostrar valor herdado como placeholder/dica visual. */
  inherited?: TextStyle;
  /** Se a section-level deve ter botão "aplicar pros cards" — não
   *  implementado, deixado pra futura iteração. */
  level?: "section" | "card";
  /** Default = collapsed. */
  defaultOpen?: boolean;
}

export function TypographyEditor({
  label,
  value,
  onChange,
  inherited,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const style = value ?? {};
  const hasOverrides = Object.values(style).some((v) => v !== undefined);

  const update = (patch: Partial<TextStyle>) => {
    const next: TextStyle = { ...style, ...patch };
    // Limpa undefined pra manter JSON enxuto.
    const cleaned: TextStyle = {};
    (Object.keys(next) as (keyof TextStyle)[]).forEach((key) => {
      if (next[key] !== undefined && next[key] !== "") {
        // @ts-expect-error string keys assignment
        cleaned[key] = next[key];
      }
    });
    onChange(Object.keys(cleaned).length === 0 ? undefined : cleaned);
  };

  // Resumo curto: "Cor • 16px • Inter 700 • italic"
  const summary = (() => {
    const parts: string[] = [];
    if (style.fontSize) parts.push(`${style.fontSize}px`);
    if (style.fontFamily) parts.push(style.fontFamily);
    if (style.fontWeight) parts.push(style.fontWeight);
    if (style.italic) parts.push("italic");
    if (parts.length === 0 && inherited) {
      const inhParts: string[] = [];
      if (inherited.fontSize) inhParts.push(`${inherited.fontSize}px`);
      if (inherited.fontFamily) inhParts.push(inherited.fontFamily);
      return `herda · ${inhParts.join(" · ") || "padrão"}`;
    }
    return parts.join(" · ") || "padrão";
  })();

  return (
    <div className="border rounded-md bg-muted/20 mb-2">
      {/* Header colapsável */}
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-accent/40 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}
        <Type className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium flex-1">{label}</span>
        <span
          className={cn(
            "text-[10px] font-mono truncate max-w-[120px]",
            hasOverrides ? "text-indigo-600" : "text-muted-foreground/70",
          )}
          title={summary}
        >
          {summary}
        </span>
      </button>

      {open && (
        <div className="px-2 pb-2 pt-1 flex flex-col gap-2 border-t">
          {/* Cor */}
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground w-12 shrink-0">
              Cor
            </Label>
            <input
              type="color"
              value={style.color ?? inherited?.color ?? "#000000"}
              onChange={(e) => update({ color: e.target.value })}
              className="size-6 rounded border cursor-pointer p-0.5 bg-transparent shrink-0"
            />
            <Input
              value={style.color ?? ""}
              onChange={(e) =>
                update({ color: e.target.value || undefined })
              }
              placeholder={inherited?.color ?? "(herda)"}
              className="text-[10px] font-mono h-7"
            />
          </div>
          {/* Swatches da paleta da página — atalho pra aplicar cores da
              marca sem precisar digitar hex. Só renderiza quando há
              paleta definida. */}
          <PaletteSwatchesRow
            onPick={(hex) => update({ color: hex })}
          />
          {/* Botão "herdar" — limpa override e volta a usar o `inherited`
              calculado a partir do tipo do elemento. */}
          {style.color && (
            <button
              type="button"
              onClick={() => update({ color: undefined })}
              className="text-[10px] text-muted-foreground self-start hover:text-foreground underline"
            >
              Limpar cor (herdar do elemento)
            </button>
          )}

          {/* Tamanho + Peso na mesma linha */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Tamanho (px)
              </Label>
              <Input
                type="number"
                min={8}
                max={200}
                value={style.fontSize ?? ""}
                onChange={(e) =>
                  update({
                    fontSize: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder={
                  inherited?.fontSize ? String(inherited.fontSize) : "—"
                }
                className="text-[11px] h-7"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Peso</Label>
              <Select
                value={style.fontWeight ?? "_"}
                onValueChange={(v) =>
                  update({ fontWeight: v === "_" ? undefined : v })
                }
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="(herda)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">(herda)</SelectItem>
                  {FONT_WEIGHTS.map((weight) => (
                    <SelectItem key={weight.value} value={weight.value}>
                      {weight.label} ({weight.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Família */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Fonte</Label>
            <Select
              value={style.fontFamily ?? "_"}
              onValueChange={(v) =>
                update({ fontFamily: v === "_" ? undefined : v })
              }
            >
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue placeholder="(herda)" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="_">(herda)</SelectItem>
                {COMMON_FONTS.map((font) => (
                  <SelectItem
                    key={font}
                    value={font}
                    style={{ fontFamily: `${font}, sans-serif` }}
                  >
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Alinhamento + Itálico */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Alinhamento
              </Label>
              <Select
                value={style.align ?? "_"}
                onValueChange={(v) =>
                  update({
                    align: v === "_" ? undefined : (v as TextStyle["align"]),
                  })
                }
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="(herda)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">(herda)</SelectItem>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-1">
              <Button
                type="button"
                variant={style.italic ? "default" : "outline"}
                size="sm"
                onClick={() => update({ italic: !style.italic || undefined })}
                className="h-7 px-2 text-xs italic flex-1"
                title="Itálico"
              >
                I
              </Button>
              <Button
                type="button"
                variant={style.underline ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  update({ underline: !style.underline || undefined })
                }
                className="h-7 px-2 text-xs underline flex-1"
                title="Sublinhado"
              >
                U
              </Button>
            </div>
          </div>

          {/* Reset all */}
          {hasOverrides && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(undefined)}
              className="h-6 text-[10px] text-muted-foreground hover:text-destructive justify-start gap-1"
            >
              <RotateCcw className="size-3" /> Resetar (herdar do padrão)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Linha compacta de swatches da paleta da página — usada nos editores
 * de cor (typography, animated border, etc) pra aplicação rápida das
 * cores da marca. Não renderiza nada quando paleta vazia.
 */
export function PaletteSwatchesRow({
  onPick,
}: {
  onPick: (hex: string) => void;
}) {
  const layout = usePagesBuilderStore((s) => s.layout);
  const palette =
    (layout as unknown as { palette?: Record<string, string> } | null)
      ?.palette ?? {};
  const swatches = Object.entries(palette);
  if (swatches.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pl-14">
      {swatches.map(([name, color]) => (
        <button
          key={name}
          type="button"
          title={`${name} (${color})`}
          onClick={() => onPick(color)}
          className="size-4 rounded border shadow-sm hover:scale-125 transition-transform"
          style={{ background: color }}
          aria-label={`Aplicar cor ${name}`}
        />
      ))}
    </div>
  );
}
