"use client";

import { useState } from "react";
import { Building2, Check, ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type BusinessManagerAnswer = "yes" | "no" | "unsure";

interface BusinessManagerStepProps {
  value: BusinessManagerAnswer | null;
  onChange: (value: BusinessManagerAnswer) => void;
}

const OPTIONS: Array<{
  value: BusinessManagerAnswer;
  label: string;
  description: string;
}> = [
  {
    value: "yes",
    label: "Sim, já tenho",
    description: "Nossa equipe conecta a sua conta à Órbita.",
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
 * Pergunta sobre conta de anúncios. Não muda o preço desde a spec 0126: serve
 * para a equipe saber se cria a conta ou conecta a que já existe.
 */
export function BusinessManagerStep({
  value,
  onChange,
}: BusinessManagerStepProps) {
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

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
                  ? "border-info bg-info/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  isSelected ? "border-info bg-info" : "border-white/20",
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
            <Building2 className="mt-0.5 size-4 shrink-0 text-info" />
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

    </div>
  );
}
