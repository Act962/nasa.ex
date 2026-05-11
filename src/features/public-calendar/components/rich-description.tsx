"use client";

import { useMemo } from "react";
import { convertJsonToHtml } from "@/lib/json-to-html";

/**
 * Renderiza a descrição do evento, que pode vir em 3 formatos diferentes
 * conforme histórico do banco:
 *
 *  1) string plana (texto puro): renderiza com `whitespace-pre-wrap`.
 *  2) TipTap JSON doc (`{"type":"doc","content":[...]}`): converte
 *     pra HTML via `convertJsonToHtml` e injeta com `dangerouslySetInnerHTML`.
 *  3) HTML já pronto (legado): se contém `<` e `>`, injeta direto.
 *
 * Bug original: o painel renderizava `event.description` como `<p>{...}</p>`,
 * mostrando o JSON cru em eventos criados via editor rico.
 */
export function RichDescription({ text }: { text: string }) {
  const rendered = useMemo<{ kind: "html" | "text"; value: string }>(() => {
    const t = text.trim();
    // Detecta TipTap JSON: começa com `{` e tem `"type"` no topo
    if (t.startsWith("{") && /"type"\s*:/.test(t.slice(0, 100))) {
      try {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed === "object" && parsed.type) {
          return { kind: "html", value: convertJsonToHtml(parsed) };
        }
      } catch {
        // não é JSON válido — cai pro texto puro
      }
    }
    // Detecta HTML "legado" (não é o TipTap doc)
    if (/<\w+[^>]*>/.test(t)) {
      return { kind: "html", value: t };
    }
    return { kind: "text", value: t };
  }, [text]);

  if (rendered.kind === "html") {
    return (
      <div
        className="prose prose-sm max-w-none text-foreground/90 dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: rendered.value }}
      />
    );
  }

  return (
    <p className="whitespace-pre-wrap text-sm text-foreground/90">
      {rendered.value}
    </p>
  );
}
