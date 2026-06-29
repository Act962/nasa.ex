"use client";

/**
 * ColorPickerWithPalette — input de cor (HTML5 `<input type="color">` para o
 * RGB) + slider de opacidade (canal alpha) + linha de swatches com as cores
 * da paleta da página (`layout.palette`, editado em Ajustes).
 *
 * O valor é armazenado em hex8 (`#rrggbbaa`) quando há transparência, ou
 * `#rrggbb` quando 100% opaco. CSS renderiza ambos nativamente.
 *
 * Permite ao user clicar numa cor da paleta da marca em vez de digitar hex
 * toda vez. Funciona com qualquer componente que mantém uma string de cor
 * em estado.
 *
 * Uso típico:
 *   <ColorPickerWithPalette
 *     value={el.color}
 *     onChange={(c) => update({ color: c })}
 *     label="Cor do texto"
 *   />
 *
 * Se a paleta estiver vazia, só mostra o input nativo. Sem swatches.
 */
import { Label } from "@/components/ui/label";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import { parseColorParts, composeHexColor } from "../../lib/color-alpha";

interface Props {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  /** Mostra o input de texto com hex ao lado do color picker. Default true. */
  showHexInput?: boolean;
}

// Fundo quadriculado pra revelar transparência atrás da cor.
const CHECKERBOARD =
  "repeating-conic-gradient(#cbd5e1 0% 25%, #ffffff 0% 50%) 50% / 8px 8px";

export function ColorPickerWithPalette({
  value,
  onChange,
  label,
  showHexInput = true,
}: Props) {
  const layout = usePagesBuilderStore((s) => s.layout);
  const palette =
    (layout as unknown as { palette?: Record<string, string> } | null)
      ?.palette ?? {};
  const swatches = Object.entries(palette);

  const { hex6, alpha } = parseColorParts(value);

  return (
    <div>
      {label && (
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
      )}
      <div className="flex items-center gap-2 mt-1">
        {/* Preview xadrez + input de cor nativo sobreposto (transparente)
            pra abrir o seletor de RGB ao clicar, mostrando a transparência. */}
        <div
          className="relative size-9 rounded border overflow-hidden shrink-0"
          style={{ background: CHECKERBOARD }}
        >
          <div
            className="absolute inset-0"
            style={{ background: value || "#000000" }}
          />
          <input
            type="color"
            value={hex6 ?? "#000000"}
            onChange={(e) => onChange(composeHexColor(e.target.value, alpha))}
            className="absolute inset-0 size-full opacity-0 cursor-pointer"
            aria-label={label ?? "Selecionar cor"}
          />
        </div>
        {showHexInput && (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="flex-1 min-w-0 h-9 rounded border px-2 text-xs font-mono bg-background"
          />
        )}
      </div>

      {/* Slider de opacidade — só quando a cor é parseável (hex/rgba). */}
      {hex6 !== null && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[9px] uppercase text-muted-foreground/70 font-semibold tracking-wide shrink-0">
            Opacidade
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={alpha}
            onChange={(e) => onChange(composeHexColor(hex6, Number(e.target.value)))}
            // Impede o PointerSensor do dnd-kit (DndContext da sidebar,
            // activationConstraint 4px) de capturar o pointerdown e roubar
            // o arraste do thumb — sem isso o slider não arrasta.
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 accent-primary cursor-pointer"
            aria-label="Opacidade"
          />
          <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right shrink-0">
            {alpha}%
          </span>
        </div>
      )}

      {swatches.length > 0 && (
        <div className="mt-2">
          <p className="text-[9px] uppercase text-muted-foreground/70 font-semibold tracking-wide mb-1">
            Paleta da página
          </p>
          <div className="flex flex-wrap gap-1.5">
            {swatches.map(([name, color]) => (
              <button
                key={name}
                type="button"
                title={`${name} (${color})`}
                onClick={() => onChange(color)}
                className="relative size-6 rounded border shadow-sm hover:scale-110 transition-transform overflow-hidden"
                style={{ background: CHECKERBOARD }}
                aria-label={`Aplicar cor ${name}`}
              >
                <span
                  className="absolute inset-0"
                  style={{ background: color }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
