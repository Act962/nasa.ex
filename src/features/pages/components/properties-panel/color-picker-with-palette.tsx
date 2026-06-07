"use client";

/**
 * ColorPickerWithPalette — input de cor padrão (HTML5 `<input type="color">`)
 * + linha de swatches com as cores definidas na paleta da página
 * (`layout.palette`, editado em Ajustes).
 *
 * Permite ao user clicar numa cor da paleta da marca em vez de digitar
 * hex toda vez. Funciona com qualquer componente que mantém uma string
 * de cor em estado.
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

interface Props {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  /** Mostra o input de texto com hex ao lado do color picker. Default true. */
  showHexInput?: boolean;
}

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

  return (
    <div>
      {label && (
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
      )}
      <div className="flex items-center gap-2 mt-1">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 rounded border cursor-pointer p-0.5 bg-transparent shrink-0"
        />
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
                className="size-6 rounded border shadow-sm hover:scale-110 transition-transform"
                style={{ background: color }}
                aria-label={`Aplicar cor ${name}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
