"use client";

import { CalendarClock, Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  estimateEarliestStart,
  formatStartDate,
  isDesiredStartTooSoon,
} from "@/features/trafego/lib/timeline";
import { DateField } from "./date-field";
import { Field } from "./field";
import { TechnicalTerm } from "../../technical-term";

export interface TimingDraft {
  desiredStartAt: string;
  hasSocialLinked: boolean | null;
  materialsReady: boolean | null;
  acknowledged: boolean;
}

/**
 * Prazo, perguntado antes do pagamento. Não é campo de data solto: as duas
 * perguntas mudam a conta, e quando a data desejada é mais cedo que a
 * possível o cliente precisa reconhecer — é o que evita a cobrança de milagre
 * depois, e é cláusula dos termos.
 */
export function TimingStep({
  value,
  onChange,
  hasAdAccount,
  reuseSocialConnection = false,
}: {
  value: TimingDraft;
  onChange: (value: TimingDraft) => void;
  /** null = "não sei dizer", tratado como quem não tem. */
  hasAdAccount: boolean | null;
  reuseSocialConnection?: boolean;
}) {
  const patch = (partial: Partial<TimingDraft>) =>
    onChange({ ...value, ...partial });

  const estimate = estimateEarliestStart({
    hasAdAccount,
    hasSocialLinked: value.hasSocialLinked,
    materialsReady: value.materialsReady,
  });
  const isTooSoon = isDesiredStartTooSoon(
    value.desiredStartAt,
    estimate.earliestStart,
  );

  return (
    <div className="space-y-5">
      <Field label="Quando você quer começar?" wide>
        <DateField
          value={value.desiredStartAt}
          onChange={(desiredStartAt) =>
            patch({ desiredStartAt, acknowledged: false })
          }
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {reuseSocialConnection ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-emerald-200">
              <Check className="size-4" />
              Instagram e Facebook já vinculados
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/40">
              Reaproveitamos esta confirmação da sua campanha anterior.
            </p>
          </div>
        ) : (
          <YesNo
            label="Seu Instagram e Facebook já estão vinculados?"
            value={value.hasSocialLinked}
            onChange={(hasSocialLinked) =>
              patch({ hasSocialLinked, acknowledged: false })
            }
          />
        )}
        <YesNo
          label={
            <>
              Seus criativos e textos já estão prontos?
              <TechnicalTerm term="creative" className="text-white/50" />
              <TechnicalTerm term="copy" className="text-white/50" />
            </>
          }
          value={value.materialsReady}
          onChange={(materialsReady) =>
            patch({ materialsReady, acknowledged: false })
          }
        />
      </div>

      <div className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <CalendarClock className="size-4 shrink-0 text-violet-300" />
          Com o que você tem hoje, a campanha começa a partir de{" "}
          <span className="text-violet-300">
            {formatStartDate(estimate.earliestStart)}
          </span>
        </p>
        <ul className="mt-2.5 space-y-1">
          {estimate.reasons.map((reason) => (
            <li
              key={reason}
              className="flex items-start gap-2 text-xs text-white/50"
            >
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-white/30" />
              {reason}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-white/35">
          São {estimate.businessDays} dias úteis de preparo. O prazo só começa a
          correr quando acessos e materiais estiverem liberados — e a aprovação
          do anúncio depende da Meta e do Google, não de nós.
        </p>
      </div>

      {isTooSoon && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-4">
          <p className="flex items-start gap-2.5 text-xs leading-relaxed text-amber-100">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
            <span>
              Você escolheu uma data anterior a{" "}
              <strong>{formatStartDate(estimate.earliestStart)}</strong>. Vamos
              fazer o possível, mas não conseguimos garantir esse prazo com o
              que falta preparar.
            </span>
          </p>

          <label className="mt-3 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={value.acknowledged}
              onChange={(event) =>
                patch({ acknowledged: event.target.checked })
              }
              className="mt-0.5 size-3.5 shrink-0 accent-amber-500"
            />
            <span className="text-xs leading-relaxed text-amber-100/90">
              Entendi que a data realista é{" "}
              <strong>{formatStartDate(estimate.earliestStart)}</strong> e que o
              prazo depende dos acessos e materiais que eu enviar.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: React.ReactNode;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-white/55">{label}</p>
      <div role="radiogroup" className="mt-1.5 flex gap-2">
        {[
          { value: true, label: "Sim" },
          { value: false, label: "Ainda não" },
        ].map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm transition",
                isSelected
                  ? "border-violet-400 bg-violet-500/[0.12] font-medium text-white"
                  : "border-white/[0.09] bg-white/[0.02] text-white/50 hover:border-white/20",
              )}
            >
              {isSelected && <Check className="size-3.5" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
