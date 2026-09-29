"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import posthog from "posthog-js";

/** Consentimento de cookies/privacidade do Órbita, exibido no chat do ASTRO. */

export type PrivacyConsentCategory = "analytics" | "advertising" | "personalization";

export type PrivacyConsentPreferences = Record<PrivacyConsentCategory, boolean>;

export const PRIVACY_CONSENT_CATEGORIES: {
  id: PrivacyConsentCategory;
  label: string;
  description: string;
}[] = [
  { id: "analytics", label: "Análise", description: "Medir o uso da plataforma e gravar sessões para achar problemas." },
  { id: "advertising", label: "Publicidade", description: "Medir campanhas de divulgação do Órbita." },
  { id: "personalization", label: "Personalização", description: "Lembrar preferências e adaptar sugestões." },
];

const ALL_GRANTED: PrivacyConsentPreferences = {
  analytics: true,
  advertising: true,
  personalization: true,
};

const ALL_DENIED: PrivacyConsentPreferences = {
  analytics: false,
  advertising: false,
  personalization: false,
};

function applyAnalyticsConsent(preferences: PrivacyConsentPreferences) {
  if (preferences.analytics) posthog.opt_in_capturing();
  else posthog.opt_out_capturing();
}

function decide(preferences: PrivacyConsentPreferences) {
  applyAnalyticsConsent(preferences);
  return { preferences, decidedAt: new Date().toISOString() };
}

interface PrivacyConsentState {
  preferences: PrivacyConsentPreferences;
  decidedAt: string | null;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (preferences: PrivacyConsentPreferences) => void;
  reopen: () => void;
}

export const usePrivacyConsentStore = create<PrivacyConsentState>()(
  persist(
    (set) => ({
      preferences: ALL_DENIED,
      decidedAt: null,
      acceptAll: () => set(decide(ALL_GRANTED)),
      rejectAll: () => set(decide(ALL_DENIED)),
      savePreferences: (preferences) => set(decide(preferences)),
      reopen: () => set({ decidedAt: null }),
    }),
    { name: "orbita-privacy-consent", version: 1 },
  ),
);
