"use client";

import { REFERRAL_SOURCES } from "@/features/trafego/lib/segments";
import { PhoneVerification, type PhoneVerificationStatus } from "./phone-verification";
import { Field, fieldClass } from "./field";
import { maskPhoneBr } from "@/features/form/lib/masks";

export interface ContactDraft {
  fullName: string;
  email: string;
  phone: string;
  referralSource: string;
}

/**
 * 06 — dados de contato. O telefone é obrigatório e verificado por código:
 * é por ele que o comprovante cai no card certo e os avisos de fase chegam.
 */
export function ContactStep({
  value,
  onChange,
  phoneVerification,
  onPhoneVerification,
  verificationEnabled,
  numberCheckEnabled,
}: {
  value: ContactDraft;
  onChange: (value: ContactDraft) => void;
  phoneVerification: PhoneVerificationStatus;
  onPhoneVerification: (status: PhoneVerificationStatus) => void;
  verificationEnabled: boolean;
  numberCheckEnabled: boolean;
}) {
  const patch = (partial: Partial<ContactDraft>) => onChange({ ...value, ...partial });

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Nome completo" required>
        <input
          value={value.fullName}
          onChange={(event) => patch({ fullName: event.target.value })}
          placeholder="José da Silva"
          className={fieldClass}
        />
      </Field>

      <Field label="E-mail" required>
        <input
          type="email"
          value={value.email}
          onChange={(event) => patch({ email: event.target.value })}
          placeholder="jose@padariadoze.com"
          className={fieldClass}
        />
      </Field>

      <Field label="Telefone / WhatsApp" required wide>
        <div className="flex gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/70">
            🇧🇷 +55
          </span>
          <input
            value={value.phone}
            onChange={(event) => {
              patch({ phone: maskPhoneBr(event.target.value) });
              // Mudou o número: a verificação anterior não vale mais.
              if (phoneVerification !== "idle") onPhoneVerification("idle");
            }}
            inputMode="tel"
            placeholder="(86) 99888-9999"
            className={fieldClass}
          />
        </div>
        <PhoneVerification
          phone={value.phone}
          status={phoneVerification}
          onStatusChange={onPhoneVerification}
          enabled={verificationEnabled}
          numberCheckEnabled={numberCheckEnabled}
        />
      </Field>

      <Field label="Como você nos conheceu?" wide>
        <select
          value={value.referralSource}
          onChange={(event) => patch({ referralSource: event.target.value })}
          className={`${fieldClass} appearance-none`}
        >
          <option value="" className="bg-[#15151a]">
            Selecione…
          </option>
          {REFERRAL_SOURCES.map((source) => (
            <option key={source} value={source} className="bg-[#15151a]">
              {source}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
