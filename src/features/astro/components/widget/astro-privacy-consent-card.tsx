"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  PRIVACY_CONSENT_CATEGORIES,
  usePrivacyConsentStore,
  type PrivacyConsentCategory,
  type PrivacyConsentPreferences,
} from "@/features/legal/hooks/use-privacy-consent-store";
import { ORBITA_LEGAL_URLS } from "@/features/legal/lib/orbita-legal";

const linkClassName = "font-semibold text-info underline underline-offset-2 hover:text-info";

export function AstroPrivacyConsentCard() {
  const decidedAt = usePrivacyConsentStore((state) => state.decidedAt);
  const storedPreferences = usePrivacyConsentStore((state) => state.preferences);
  const acceptAll = usePrivacyConsentStore((state) => state.acceptAll);
  const rejectAll = usePrivacyConsentStore((state) => state.rejectAll);
  const savePreferences = usePrivacyConsentStore((state) => state.savePreferences);
  const [isShowingOptions, setIsShowingOptions] = useState(false);
  const [draftPreferences, setDraftPreferences] =
    useState<PrivacyConsentPreferences>(storedPreferences);

  if (decidedAt) return null;

  const toggleCategory = (category: PrivacyConsentCategory, isEnabled: boolean) =>
    setDraftPreferences((current) => ({ ...current, [category]: isEnabled }));

  return (
    <section
      aria-label="Controle sua privacidade"
      className="mx-3 my-3 rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-4 text-foreground shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-info">Controle sua privacidade</h3>
        <span className="text-xs font-medium text-info/80">Órbita</span>
      </header>

      <p className="mt-2 text-[13px] text-foreground/80">
        Nosso site usa cookies para melhorar a navegação.
      </p>

      <p className="mt-2 rounded-lg border border-foreground/15 p-2.5 text-xs italic leading-relaxed text-foreground/60">
        Usamos cookies para manter sua sessão, medir o uso da plataforma e lembrar suas
        preferências. Você escolhe o que fica ligado além do essencial.
      </p>

      <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        <a href={ORBITA_LEGAL_URLS.privacy} target="_blank" rel="noreferrer" className={linkClassName}>
          Política de Privacidade
        </a>
        <span className="text-info">-</span>
        <a href={ORBITA_LEGAL_URLS.cookies} target="_blank" rel="noreferrer" className={linkClassName}>
          Política de Cookies
        </a>
        <span className="text-info">-</span>
        <a href={ORBITA_LEGAL_URLS.terms} target="_blank" rel="noreferrer" className={linkClassName}>
          Termos de uso
        </a>
        <span className="text-info">-</span>
        <button type="button" onClick={() => setIsShowingOptions(true)} className={linkClassName}>
          Opt-out
        </button>
      </p>

      {isShowingOptions && (
        <ul className="mt-3 space-y-2 rounded-lg border border-foreground/10 p-2.5">
          <li className="flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-medium text-foreground/90">Necessários</p>
              <p className="text-foreground/50">Login e segurança. Sempre ativos.</p>
            </div>
            <Switch checked disabled aria-label="Cookies necessários" />
          </li>
          {PRIVACY_CONSENT_CATEGORIES.map((category) => (
            <li key={category.id} className="flex items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-medium text-foreground/90">{category.label}</p>
                <p className="text-foreground/50">{category.description}</p>
              </div>
              <Switch
                checked={draftPreferences[category.id]}
                onCheckedChange={(isEnabled) => toggleCategory(category.id, isEnabled)}
                aria-label={`Cookies de ${category.label.toLowerCase()}`}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        {isShowingOptions ? (
          <button
            type="button"
            onClick={() => savePreferences(draftPreferences)}
            className="text-xs font-semibold text-foreground/80 underline underline-offset-2 hover:text-foreground"
          >
            Salvar escolhas
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsShowingOptions(true)}
            className="text-xs font-semibold text-foreground/80 underline underline-offset-2 hover:text-foreground"
          >
            Minhas opções
          </button>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={rejectAll}
            className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/10"
          >
            Rejeitar
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-full bg-info px-4 py-1.5 text-xs font-semibold text-white hover:bg-info"
          >
            Aceitar
          </button>
        </div>
      </div>
    </section>
  );
}
