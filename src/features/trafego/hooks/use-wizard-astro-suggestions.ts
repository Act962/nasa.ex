import { useCallback, useRef, useState } from "react";

/**
 * Sugestões do Astro no passo a passo (spec 0129, RF-5, CA-4): campo que o cliente já mexeu
 * nunca é sobrescrito, e o selo "Sugerido pelo Astro" some quando ele troca o valor.
 */

export type SuggestedField = "objective" | "campaignType" | "audience" | "budget" | "message";

export function useWizardAstroSuggestions() {
  const [reasons, setReasons] = useState<Partial<Record<SuggestedField, string>>>({});
  const touchedFields = useRef(new Set<SuggestedField>());

  const markTouched = useCallback((field: SuggestedField) => {
    touchedFields.current.add(field);
    setReasons((previous) => {
      if (!(field in previous)) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }, []);

  const suggest = useCallback((field: SuggestedField, reason: string, apply: () => void) => {
    if (touchedFields.current.has(field)) return;
    apply();
    setReasons((previous) => ({ ...previous, [field]: reason }));
  }, []);

  return { reasons, markTouched, suggest };
}
