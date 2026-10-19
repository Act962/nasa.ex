"use client";

import { useEffect, useState } from "react";
import type { ElementBase } from "../../types";
import { usePageRenderContext } from "../public/page-context";

// sessionStorage do PageAnalytics (camelCase) → parâmetro que o formulário lê.
const UTM_KEY_PAIRS = [
  ["utmSource", "utm_source"],
  ["utmMedium", "utm_medium"],
  ["utmCampaign", "utm_campaign"],
  ["utmContent", "utm_content"],
  ["utmTerm", "utm_term"],
] as const;

/**
 * Embedded Form — renderiza um Formulário NASA existente dentro da
 * landing via iframe pointing to the public form route.
 *
 * Optionally:
 * - `trackingId` sobrescreve o `FormSettings.trackingId` do form (lead
 *   cai num tracking específico definido na page, não no form).
 * - Popover de confirmação: ao detectar submit do form (via
 *   postMessage do iframe), abre modal de "confirmar nome + número"
 *   antes de finalizar.
 *
 * Por que iframe? Reusa toda a UI/validação/upload do FormBuilder
 * sem duplicação. O form público já tem submit handler em
 * `/forms/public/:id/submit` que cria lead automaticamente.
 *
 * NOTA: pra trackingId override funcionar, o submit handler do
 * form deve respeitar query param `?override_tracking_id=`. Se não
 * suportar, o lead cai no tracking default do form (e o aviso fica
 * no editor).
 */
export function EmbeddedForm({ element }: { element: ElementBase }) {
  const { appOrigin } = usePageRenderContext();
  const formId = (element.formId as string) ?? "";
  const trackingId = (element.trackingId as string) ?? "";
  const bgColor = (element.bgColor as string) ?? "#ffffff";

  if (!formId) {
    return (
      <div
        className="w-full h-full min-h-64 flex items-center justify-center border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground p-6 text-center"
        style={{ background: bgColor }}
      >
        Configure um formulário no painel à direita
      </div>
    );
  }

  // Query params:
  // - embed=1 → form usa estilo "embedded" (sem header próprio, sem
  //   footer NASA)
  // - tracking_override=<id> → se o handler suportar
  const params = new URLSearchParams({ embed: "1" });
  if (trackingId) params.set("tracking_override", trackingId);

  // Propaga as UTMs da página pro form no formato `utm_*`, o único que o formulário lê (spec 0114, RF-6).
  // A URL atual vem primeiro: na primeira visita o PageAnalytics ainda não gravou o sessionStorage.
  if (typeof window !== "undefined") {
    const currentQuery = new URLSearchParams(window.location.search);
    let storedUtm: Partial<Record<string, string>> = {};
    try {
      storedUtm = JSON.parse(sessionStorage.getItem("nasa_page_utm") ?? "{}") as Partial<Record<string, string>>;
    } catch {
      // sessionStorage bloqueado ou corrompido: fica só com a URL.
    }
    for (const [storedKey, queryKey] of UTM_KEY_PAIRS) {
      const utmValue = currentQuery.get(queryKey) ?? storedUtm[storedKey];
      if (utmValue) params.set(queryKey, utmValue);
    }
  }

  // Endpoint público do form
  // Em domínio próprio a rota do formulário não existe: o iframe volta para o app.
  const src = `${appOrigin ?? ""}/submit-form/${formId}?${params.toString()}`;

  return (
    <div
      className="w-full h-full overflow-hidden rounded-xl border"
      style={{ background: bgColor }}
    >
      <iframe
        src={src}
        title="Formulário"
        className="w-full h-full border-0 block"
        loading="lazy"
      />
    </div>
  );
}
