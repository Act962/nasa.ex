"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { WhatsappWarmupNote } from "./whatsapp-warmup-note";

export type OfficialNumberAnswer = "yes" | "no";

const OPTIONS: Array<{
  value: OfficialNumberAnswer;
  label: string;
  description: string;
}> = [
  {
    value: "yes",
    label: "Sim, já tenho um número na API Oficial",
    description: "Vou usar um número que já está na minha conta da Meta.",
  },
  {
    value: "no",
    label: "Não, preciso adquirir um novo número",
    description: "Vocês podem providenciar um novo. (Serviço incluído no setup)",
  },
];

/** 01B — a pergunta que decide se há setup e qual sub-tela vem depois. */
export function WhatsappNumberStep({
  value,
  onChange,
  setupBrlCents,
}: {
  value: OfficialNumberAnswer | null;
  onChange: (value: OfficialNumberAnswer) => void;
  setupBrlCents: number;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-white/55">
        Para enviar mensagens em massa, é obrigatório utilizar um número na API
        oficial da Meta.
      </p>

      <div role="radiogroup" className="space-y-2.5">
        {OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition",
                isSelected
                  ? "border-violet-400 bg-violet-500/[0.09]"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border transition",
                  isSelected ? "border-violet-400 bg-violet-500" : "border-white/20",
                )}
              >
                {isSelected && <Check className="size-2.5 text-white" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-white/45">
                  {option.description}
                  {option.value === "no" && setupBrlCents > 0 && (
                    <> — setup de {formatBrlFromCents(setupBrlCents)}.</>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 01B.2 — confirmação de que a equipe providencia o número. */
export function WhatsappAcquireStep({
  confirmed,
  onConfirm,
  setupBrlCents,
}: {
  confirmed: boolean;
  onConfirm: (value: boolean) => void;
  setupBrlCents: number;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-white/55">
        Nós podemos disponibilizar um número novo para você, já configurado na API
        Oficial do WhatsApp.
      </p>

      <button
        type="button"
        role="checkbox"
        aria-checked={confirmed}
        onClick={() => onConfirm(!confirmed)}
        className={cn(
          "flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition",
          confirmed
            ? "border-violet-400 bg-violet-500/[0.09]"
            : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded border transition",
            confirmed ? "border-violet-400 bg-violet-500" : "border-white/20",
          )}
        >
          {confirmed && <Check className="size-2.5 text-white" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-white">
            Sim, quero que vocês providenciem um novo número
          </span>
          <span className="mt-0.5 block text-xs text-white/45">
            O número será configurado na API Oficial e o serviço já está incluído no
            setup da campanha
            {setupBrlCents > 0 ? ` (${formatBrlFromCents(setupBrlCents)})` : " — grátis nesta faixa"}.
          </span>
        </span>
      </button>

      <WhatsappWarmupNote />
    </div>
  );
}
