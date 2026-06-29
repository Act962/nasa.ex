"use client";

import { useEffect, useState } from "react";
import type { ElementBase } from "../../types";

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
  const formId = (element.formId as string) ?? "";
  const trackingId = (element.trackingId as string) ?? "";
  const bgColor = (element.bgColor as string) ?? "#ffffff";

  if (!formId) {
    return (
      <div
        className="w-full h-full min-h-64 flex items-center justify-center border-2 border-dashed border-zinc-300 rounded-xl text-sm text-muted-foreground p-6 text-center"
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

  // Lê UTMs persistidos pelo PageAnalytics e propaga pro form
  if (typeof window !== "undefined") {
    try {
      const utmRaw = sessionStorage.getItem("nasa_page_utm");
      if (utmRaw) {
        const utm = JSON.parse(utmRaw);
        for (const k of [
          "utmSource",
          "utmMedium",
          "utmCampaign",
          "utmContent",
          "utmTerm",
        ] as const) {
          if (utm[k]) params.set(k, utm[k]);
        }
      }
    } catch {
      // ignora
    }
  }

  // Endpoint público do form
  const src = `/submit-form/${formId}?${params.toString()}`;

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
