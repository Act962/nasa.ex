"use client";

import { Check, CreditCard, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrafegoPaymentMethod = "CARD" | "PIX";

/**
 * A diferença de prazo é dita aqui, não na tela seguinte — é o que evita a
 * pessoa escolher PIX achando que a campanha começa no mesmo minuto.
 *
 * Com `pixAutoConfirms`, essa diferença deixa de existir: a cobrança é do Asaas
 * e confirma sozinha. Sem ele, o PIX ainda passa pela conferência da equipe, e
 * a descrição precisa dizer isso.
 */
export function PaymentMethodStep({
  value,
  onChange,
  pixAvailable,
  pixAutoConfirms,
}: {
  value: TrafegoPaymentMethod;
  onChange: (value: TrafegoPaymentMethod) => void;
  pixAvailable: boolean;
  pixAutoConfirms: boolean;
}) {
  if (!pixAvailable) return null;

  const options: Array<{
    value: TrafegoPaymentMethod;
    icon: typeof CreditCard;
    label: string;
    description: string;
  }> = [
    {
      value: "CARD",
      icon: CreditCard,
      label: "Cartão de crédito",
      description: "Confirmação na hora, pelo Stripe.",
    },
    {
      value: "PIX",
      icon: QrCode,
      label: "PIX",
      description: pixAutoConfirms
        ? "QR Code na tela seguinte. Confirmação automática."
        : "Você paga na nossa chave e envia o comprovante pelo WhatsApp.",
    },
  ];

  return (
    <div>
      <p className="text-xs font-medium text-white/55">Forma de pagamento</p>
      <div role="radiogroup" className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition",
                isSelected
                  ? "border-violet-400 bg-violet-500/[0.09]"
                  : "border-white/[0.09] bg-white/[0.02] hover:border-white/20",
              )}
            >
              {isSelected && (
                <span className="absolute right-3 top-3 flex size-4 items-center justify-center rounded-full bg-violet-500">
                  <Check className="size-2.5 text-white" />
                </span>
              )}
              <option.icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  isSelected ? "text-violet-300" : "text-white/40",
                )}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-white/45">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
