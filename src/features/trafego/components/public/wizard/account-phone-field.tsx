"use client";

import { maskPhoneBr } from "@/features/form/lib/masks";
import { Field, fieldClass } from "./field";

/**
 * WhatsApp de quem está logado e não tem telefone na conta (spec 0129): é o único dado
 * do antigo passo Contato que o login não traz. Serve para a equipe falar com o cliente.
 */
export function AccountPhoneField({ value, onChange }: { value: string; onChange: (phone: string) => void }) {
  return (
    <Field
      label="Seu WhatsApp"
      required
      hint="Para a equipe falar com você sobre a campanha. Não é o número que aparece no anúncio."
    >
      <div className="flex gap-2">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/70">
          🇧🇷 +55
        </span>
        <input
          value={value}
          onChange={(event) => onChange(maskPhoneBr(event.target.value))}
          inputMode="tel"
          placeholder="(86) 99888-9999"
          className={fieldClass}
        />
      </div>
    </Field>
  );
}
