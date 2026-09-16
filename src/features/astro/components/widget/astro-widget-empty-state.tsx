"use client";

import {
  AlarmClock,
  CalendarClock,
  ListChecks,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Tela inicial do painel: uma pergunta grande e três sugestões que dependem de
 * onde o usuário está. Tocar numa sugestão envia na hora.
 */

interface WidgetSuggestion {
  label: string;
  icon: LucideIcon;
}

const FINANCE_SUGGESTIONS: WidgetSuggestion[] = [
  { label: "Quanto tenho a pagar esta semana?", icon: CalendarClock },
  { label: "Como está meu fluxo de caixa?", icon: TrendingUp },
  { label: "O que está vencido?", icon: AlarmClock },
];

const GENERAL_SUGGESTIONS: WidgetSuggestion[] = [
  { label: "O que tenho pra fazer hoje?", icon: ListChecks },
  { label: "Quantos leads entraram esta semana?", icon: Users },
  { label: "Como está o financeiro do mês?", icon: Wallet },
];

export function AstroWidgetEmptyState({
  pathname,
  disabled,
  onSelect,
}: {
  pathname: string;
  disabled: boolean;
  onSelect: (text: string) => void;
}) {
  const isOnFinance = pathname.startsWith("/payment");
  const suggestions = isOnFinance ? FINANCE_SUGGESTIONS : GENERAL_SUGGESTIONS;

  return (
    <div className="flex min-h-full flex-col justify-end px-4 pb-4 pt-6">
      <h2 className="mb-5 text-[1.7rem] font-semibold leading-tight tracking-tight text-white">
        O que você quer saber?
      </h2>
      <div className="space-y-1">
        {suggestions.map(({ label, icon: SuggestionIcon }) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(label)}
            className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left text-sm text-white/75 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300">
              <SuggestionIcon className="size-5" />
            </span>
            {label}
          </button>
        ))}
      </div>
      {isOnFinance && (
        <p className="mt-4 text-xs leading-relaxed text-white/35">
          Anexe um boleto ou uma nota fiscal pelo clipe e peça pra lançar. Nada é gravado sem a
          sua confirmação.
        </p>
      )}
    </div>
  );
}
