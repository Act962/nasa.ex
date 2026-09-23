"use client";

import { AlertCircle } from "lucide-react";
import {
  formatBrazilianDocument,
  isValidBrazilianDocument,
} from "@/features/payment/lib/documents/normalize-document";

/**
 * CPF/CNPJ do pagador. Aparece só na trilha PIX: o Asaas exige documento para
 * emitir cobrança nominal, e o cartão não precisa disso (spec 0022 D-1).
 */
export function PayerDocumentStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const digits = value.replace(/\D/g, "");
  const isComplete = digits.length === 11 || digits.length === 14;
  const isInvalid = isComplete && !isValidBrazilianDocument(value);

  return (
    <div>
      <label
        htmlFor="trafego-payer-document"
        className="text-xs font-medium text-white/55"
      >
        CPF ou CNPJ do pagador
      </label>
      <input
        id="trafego-payer-document"
        inputMode="numeric"
        autoComplete="off"
        value={formatBrazilianDocument(value) ?? value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        placeholder="000.000.000-00"
        maxLength={18}
        aria-invalid={isInvalid}
        className="mt-1.5 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400"
      />
      {isInvalid ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-300">
          <AlertCircle className="size-3.5 shrink-0" />
          Confira os dígitos — esse documento não é válido.
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-white/35">
          Vai no recibo da cobrança PIX. Não usamos para mais nada.
        </p>
      )}
    </div>
  );
}
