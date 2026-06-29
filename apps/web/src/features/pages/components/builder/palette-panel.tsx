/**
 * palette-panel — bloco "Padrão de cores da página" da aba Ajustes.
 *
 * Cada cor tem nome (livre) + valor hex. Persistido em `layout.palette`
 * como Record<string, string>. Quando o user adiciona uma cor aqui, ela
 * aparece como swatch em TODOS os color pickers da página
 * (ColorPickerWithPalette).
 *
 * Defaults sugeridos: primary, accent, bg, fg, muted, danger, success.
 * O user pode renomear/remover/adicionar à vontade.
 */
"use client";

import { Palette, Trash2, Plus } from "lucide-react";

const DEFAULT_PALETTE_SUGGESTIONS = [
  { name: "primary", color: "#6366f1" },
  { name: "accent", color: "#f59e0b" },
  { name: "bg", color: "#ffffff" },
  { name: "fg", color: "#0f172a" },
  { name: "muted", color: "#94a3b8" },
  { name: "danger", color: "#ef4444" },
  { name: "success", color: "#10b981" },
];

export function PalettePanel({
  palette,
  updatePalette,
}: {
  palette: Record<string, string>;
  updatePalette: (patch: Record<string, string | undefined>) => void;
}) {
  const entries = Object.entries(palette);

  const addColor = () => {
    // Gera nome único — color1, color2, etc — pra não colidir com
    // existentes. O user pode renomear depois.
    let suffix = 1;
    while (palette[`color${suffix}`] !== undefined) suffix++;
    updatePalette({ [`color${suffix}`]: "#000000" });
  };

  const renameColor = (oldName: string, newName: string) => {
    if (!newName || newName === oldName || palette[newName] !== undefined) {
      return;
    }
    const value = palette[oldName];
    // Como `updatePalette` é um merge, precisa remover a antiga + setar nova.
    updatePalette({ [oldName]: undefined, [newName]: value });
  };

  const updateColor = (name: string, hex: string) => {
    updatePalette({ [name]: hex });
  };

  const removeColor = (name: string) => {
    updatePalette({ [name]: undefined });
  };

  const seedDefaults = () => {
    // Só preenche as que faltam — não sobrescreve as já existentes.
    const patch: Record<string, string | undefined> = {};
    for (const { name, color } of DEFAULT_PALETTE_SUGGESTIONS) {
      if (palette[name] === undefined) patch[name] = color;
    }
    if (Object.keys(patch).length > 0) updatePalette(patch);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
          <Palette className="size-3" />
          Padrão de cores da página
        </p>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
        Cores reusáveis em toda a página — vão aparecer como atalhos nos
        seletores de cor dos elementos.
      </p>

      {entries.length === 0 && (
        <div className="rounded border border-dashed bg-muted/30 p-3 text-center mb-2">
          <p className="text-[10px] text-muted-foreground mb-2">
            Nenhuma cor na paleta ainda.
          </p>
          <button
            type="button"
            onClick={seedDefaults}
            className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium underline"
          >
            Usar paleta padrão (primary, accent, bg…)
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {entries.map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <input
              type="color"
              value={color}
              onChange={(e) => updateColor(name, e.target.value)}
              className="size-7 rounded border cursor-pointer p-0.5 bg-transparent shrink-0"
              title={`Editar ${name}`}
            />
            <input
              type="text"
              defaultValue={name}
              onBlur={(e) => renameColor(name, e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              className="flex-1 min-w-0 h-7 rounded border px-2 text-[11px] bg-background"
              placeholder="nome"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => updateColor(name, e.target.value)}
              className="w-20 h-7 rounded border px-2 text-[10px] font-mono bg-background"
              placeholder="#000000"
            />
            <button
              type="button"
              onClick={() => removeColor(name)}
              className="size-7 rounded border flex items-center justify-center hover:bg-destructive/10 shrink-0"
              title={`Remover ${name}`}
            >
              <Trash2 className="size-3 text-destructive" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addColor}
        className="mt-2 w-full h-8 rounded border border-dashed text-[11px] flex items-center justify-center gap-1 hover:bg-accent text-muted-foreground"
      >
        <Plus className="size-3" />
        Adicionar cor
      </button>
    </div>
  );
}
