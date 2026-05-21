"use client";

import { cn } from "@/lib/utils";

/**
 * Seletor de temperatura do lead — 4 níveis coloridos. Usado no painel de
 * Detalhes do Lead. Cada nível tem cor própria que casa com a paleta usada
 * na barra lateral do card no kanban (`TEMP_COLOR` em `lead-item.tsx`).
 *
 * Cada pill funciona como toggle radio: click no nível selecionado é no-op
 * (o handler de update checa igualdade antes do mutate). Auto-save imediato
 * sem botão "Salvar" — segue o padrão dos outros campos da tela.
 */

type Temperature = "COLD" | "WARM" | "HOT" | "VERY_HOT";

interface TempOption {
  value: Temperature;
  label: string;
  /** Cor de fundo quando selecionado. */
  bg: string;
  /** Cor do texto quando selecionado. */
  text: string;
  /** Tinta sutil quando não selecionado (hint visual da temperatura). */
  hint: string;
}

const OPTIONS: TempOption[] = [
  {
    value: "COLD",
    label: "Frio",
    bg: "bg-[#3498db]",
    text: "text-white",
    hint: "text-[#3498db]",
  },
  {
    value: "WARM",
    label: "Quente",
    bg: "bg-[#f1c40f]",
    text: "text-black",
    hint: "text-[#f1c40f]",
  },
  {
    value: "HOT",
    label: "Muito quente",
    bg: "bg-[#e67e22]",
    text: "text-white",
    hint: "text-[#e67e22]",
  },
  {
    value: "VERY_HOT",
    label: "Quentíssimo",
    bg: "bg-[#e74c3c]",
    text: "text-white",
    hint: "text-[#e74c3c]",
  },
];

interface Props {
  value: Temperature;
  onChange: (next: Temperature) => void;
  disabled?: boolean;
}

export function TemperatureSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="w-full space-y-1.5 px-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Temperatura
      </p>
      {/* 2x2 em vez de 4 colunas — o painel é estreito (w-72) e "Muito
          quente"/"Quentíssimo" não cabem em 1/4 da largura. Cada célula
          agora tem ~130px, espaço sobrando pros labels mais longos. */}
      <div className="grid grid-cols-2 gap-1.5">
        {OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                active
                  ? `${opt.bg} ${opt.text} border-transparent shadow-sm`
                  : `bg-background border-input hover:bg-muted/50 text-foreground`,
              )}
              title={opt.label}
            >
              {/* Bolinha colorida sempre visível — dá pista visual da
                  temperatura mesmo quando o botão não está selecionado. */}
              <span
                className={cn("size-2 shrink-0 rounded-full", opt.bg, {
                  "ring-1 ring-white/50": active,
                })}
              />
              <span className="truncate">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
