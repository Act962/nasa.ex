"use client";

import dynamic from "next/dynamic";

/**
 * Mount do Dev Inspector — gated por NODE_ENV.
 *
 * Em produção: `process.env.NODE_ENV === "development"` é inlinedo
 * como `false` pelo build do Next.js, esta linha vira `() => null`,
 * e o tree-shaker elimina o módulo `./inspector` do bundle final.
 *
 * Em dev: lazy load via `next/dynamic` com `ssr: false` (o inspector
 * só faz sentido no client — DOM + React Fiber).
 *
 * Verificação pós-build: `pnpm build && grep -r "DevInspector" .next/`
 * → deve retornar zero matches em chunks de produção.
 */
export const DevInspectorMount =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("./inspector").then((m) => m.DevInspector), {
        ssr: false,
      })
    : () => null;
