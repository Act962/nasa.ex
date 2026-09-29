"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  PRIVACY_CONSENT_CATEGORIES,
  usePrivacyConsentStore,
  type PrivacyConsentCategory,
  type PrivacyConsentPreferences,
} from "@/features/legal/hooks/use-privacy-consent-store";

const DECIDED_AT_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function CookiePreferencesPanel() {
  const decidedAt = usePrivacyConsentStore((state) => state.decidedAt);
  const storedPreferences = usePrivacyConsentStore((state) => state.preferences);
  const acceptAll = usePrivacyConsentStore((state) => state.acceptAll);
  const rejectAll = usePrivacyConsentStore((state) => state.rejectAll);
  const savePreferences = usePrivacyConsentStore((state) => state.savePreferences);
  const [draftPreferences, setDraftPreferences] =
    useState<PrivacyConsentPreferences>(storedPreferences);
  const [hasMounted, setHasMounted] = useState(false);

  // A escolha vive no localStorage; antes de montar, o servidor não a conhece.
  useEffect(() => setHasMounted(true), []);
  useEffect(() => setDraftPreferences(storedPreferences), [storedPreferences]);

  const toggleCategory = (category: PrivacyConsentCategory, isEnabled: boolean) =>
    setDraftPreferences((current) => ({ ...current, [category]: isEnabled }));

  return (
    <section
      id="preferencias"
      aria-label="Suas preferências de cookies"
      className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-sky-400">Suas preferências</h2>
        <p className="text-xs text-white/40">
          {hasMounted && decidedAt
            ? `Escolha salva em ${DECIDED_AT_FORMATTER.format(new Date(decidedAt))}`
            : "Você ainda não fez uma escolha neste navegador."}
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        <li className="flex items-center justify-between gap-4 text-sm">
          <div>
            <p className="font-medium text-white/90">Necessários</p>
            <p className="text-xs text-white/50">Login, segurança e origem do acesso. Sempre ativos.</p>
          </div>
          <Switch checked disabled aria-label="Cookies necessários" />
        </li>
        {PRIVACY_CONSENT_CATEGORIES.map((category) => (
          <li key={category.id} className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="font-medium text-white/90">{category.label}</p>
              <p className="text-xs text-white/50">{category.description}</p>
            </div>
            <Switch
              checked={hasMounted && draftPreferences[category.id]}
              onCheckedChange={(isEnabled) => toggleCategory(category.id, isEnabled)}
              aria-label={`Cookies de ${category.label.toLowerCase()}`}
            />
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => savePreferences(draftPreferences)}
          className="text-sm font-semibold text-white/80 underline underline-offset-2 hover:text-white"
        >
          Salvar escolhas
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={rejectAll}
            className="rounded-full border border-white/30 px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Rejeitar
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-400"
          >
            Aceitar
          </button>
        </div>
      </div>
    </section>
  );
}
