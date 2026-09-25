"use client";

import { cn } from "@/lib/utils";
import type { AstroActionChoicePayload } from "@/features/astro/lib/astro-action-result";

/**
 * Quando o Astro precisa que o usuário escolha — qual tracking, qual lead,
 * qual das ações que ele considerou. A spec 0025 (RF-4) previa botões, mas
 * nada renderizava o payload: a pergunta chegava como texto solto e o
 * usuário tinha que digitar o nome de volta.
 *
 * Os botões não chamam API: mandam a escolha como mensagem, o mesmo caminho
 * de quem digita — assim a resposta passa pelo classificador normalmente.
 */
export function AstroChoiceCard({
  payload,
  onRespond,
  disabled,
}: {
  payload: AstroActionChoicePayload;
  onRespond: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-900/60">
      <div className="px-3.5 py-3">
        <p className="text-sm font-semibold text-white">{payload.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
          {payload.description}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 px-3.5 pb-3.5">
        {payload.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onRespond(option.label)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              "bg-violet-500/15 text-violet-200 hover:bg-violet-500/25",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
