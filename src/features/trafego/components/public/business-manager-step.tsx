"use client";

import { useState } from "react";
import { Building2, Check, ChevronDown, HelpCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";

export type BusinessManagerAnswer = "yes" | "no" | "unsure";

interface BusinessManagerStepProps {
  value: BusinessManagerAnswer | null;
  onChange: (value: BusinessManagerAnswer) => void;
  /** Setup da faixa atual; 0 quando é gratuito. */
  setupBrlCents: number;
}

const OPTIONS: Array<{
  value: BusinessManagerAnswer;
  label: string;
  description: string;
}> = [
  {
    value: "yes",
    label: "Sim, já tenho",
    description: "Vamos pedir acesso à sua conta — sem taxa de setup.",
  },
  {
    value: "no",
    label: "Não tenho",
    description: "Criamos e configuramos tudo para você.",
  },
  {
    value: "unsure",
    label: "Não sei dizer",
    description: "Sem problema: verificamos antes de começar.",
  },
];

/**
 * Pergunta sobre conta de anúncios. Quem não tem BM paga o setup, então a
 * resposta muda o preço — daí a explicação vir junto, e não num tooltip.
 */
export function BusinessManagerStep({
  value,
  onChange,
  setupBrlCents,
}: BusinessManagerStepProps) {
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const willBeCharged = value === "no" || value === "unsure";

  return (
    <div>
      <div className="grid gap-2">
        {OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition",
                isSelected
                  ? "border-violet-400 bg-violet-500/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  isSelected ? "border-violet-400 bg-violet-500" : "border-white/20",
                )}
              >
                {isSelected && <Check className="size-2.5 text-white" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">
                  {option.label}
                </span>
                <span className="block text-xs text-white/50">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setIsExplanationOpen((open) => !open)}
        className="mt-4 flex w-full items-center gap-2 text-left text-xs text-white/50 transition hover:text-white/70"
      >
        <HelpCircle className="size-3.5 shrink-0" />
        O que é uma BM (Business Manager)?
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 transition-transform",
            isExplanationOpen && "rotate-180",
          )}
        />
      </button>

      {isExplanationOpen && (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start gap-2.5">
            <Building2 className="mt-0.5 size-4 shrink-0 text-violet-300" />
            <div className="space-y-2 text-xs leading-relaxed text-white/60">
              <p>
                A <strong className="text-white/80">Business Manager</strong> é a
                central da Meta onde ficam a sua página, o perfil do Instagram, o
                pixel do site e a conta que paga os anúncios. É o equivalente ao
                &quot;CNPJ digital&quot; do seu negócio dentro do Facebook.
              </p>
              <p>
                Ela importa porque tudo que a campanha gera —{" "}
                <strong className="text-white/80">
                  público, histórico e aprendizado do algoritmo
                </strong>{" "}
                — fica guardado nela. Se a conta for nossa, você perde esse acervo
                ao trocar de agência. Sendo sua, o que construímos continua seu.
              </p>
              <p>
                Não tem uma? Nós criamos no seu nome, configuramos o pixel, ligamos
                as páginas e deixamos tudo pronto. Você fica como proprietário.
              </p>
            </div>
          </div>
        </div>
      )}

      {willBeCharged && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <div className="text-xs leading-relaxed text-amber-100">
            {setupBrlCents > 0 ? (
              <>
                Como você ainda não tem conta de anúncios, há uma{" "}
                <strong>taxa única de setup de {formatBrlFromCents(setupBrlCents)}</strong>{" "}
                para criar e configurar a BM no seu nome. Ela some a partir de{" "}
                <strong>R$ 2.501</strong> de investimento — dá para conferir na
                simulação do próximo passo.
              </>
            ) : (
              <>
                Você ainda não tem conta de anúncios, mas no valor que você vai
                investir o <strong>setup é gratuito</strong>: criamos e configuramos
                a BM no seu nome sem custo.
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
