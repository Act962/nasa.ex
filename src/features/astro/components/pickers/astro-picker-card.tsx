"use client";

import type { AstroActionPickerPayload } from "@/features/astro/lib/astro-action-result";
import { AstroDateTimePicker } from "./astro-datetime-picker";
import { AstroEntityPicker } from "./astro-entity-picker";
import { AstroSelectPicker } from "./astro-select-picker";
import { AstroTextPicker } from "./astro-text-picker";

/**
 * Pergunta do ASTRO respondida no próprio cartão (spec 0033, RF-1/RF-3):
 * busca de registro ou seletor de data. Enquanto ele está aberto, o campo de
 * texto do widget fica travado — a resposta sai daqui, já estruturada.
 */
export function AstroPickerCard({
  payload,
  onRespond,
  disabled,
}: {
  payload: AstroActionPickerPayload;
  onRespond: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-line/70 bg-card/60">
      <div className="px-3.5 pb-2 pt-3">
        <p className="text-sm font-semibold text-foreground">{payload.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{payload.description}</p>
      </div>

      <div className="px-3.5 pb-3">
        {payload.picker.kind === "entity" && (
          <AstroEntityPicker
            picker={payload.picker}
            initialOptions={payload.options}
            onPick={onRespond}
            disabled={disabled}
          />
        )}
        {payload.picker.kind === "datetime" && (
          <AstroDateTimePicker picker={payload.picker} onPick={onRespond} disabled={disabled} />
        )}
        {payload.picker.kind === "text" && (
          <AstroTextPicker picker={payload.picker} onPick={onRespond} disabled={disabled} />
        )}
        {payload.picker.kind === "select" && (
          <AstroSelectPicker picker={payload.picker} onPick={onRespond} disabled={disabled} />
        )}
      </div>

      <div className="border-t border-line/80 px-3.5 py-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRespond("cancelar")}
          className="text-[11px] text-muted-foreground transition-colors hover:text-muted-foreground disabled:opacity-50"
        >
          Cancelar pedido
        </button>
      </div>
    </div>
  );
}
