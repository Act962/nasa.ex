"use client";

import dynamic from "next/dynamic";

/**
 * Wrapper lazy do editor TipTap.
 *
 * O `RichtTextEditor` puxa `@tiptap/react` + extensions (ProseMirror), que é
 * pesado e entrava no grafo da rota mais quente (`/tracking/[trackingId]` via
 * `TabNotes`). Carregando sob demanda com `ssr: false`, o editor só compila/baixa
 * quando a aba de notas é realmente renderizada — alivia o `next dev` e o bundle.
 *
 * Mantém o mesmo nome exportado (`RichtTextEditor`) pra ser drop-in nos
 * consumidores; props e children passam direto.
 */
export const RichtTextEditor = dynamic(
  () => import("./editor").then((m) => ({ default: m.RichtTextEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-32 w-full animate-pulse rounded-md bg-muted" />
    ),
  },
);
