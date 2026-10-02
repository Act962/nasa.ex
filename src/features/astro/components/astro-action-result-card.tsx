"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  hasPreviewablePage,
  type AstroActionDonePayload,
} from "@/features/astro/lib/astro-action-result";

/**
 * Cartão de ação concluída — com prévia da página pública quando existe.
 *
 * A prévia é um `iframe` da própria página em proporção 3:4, e não um PDF
 * gerado: renderizar PDF exigiria headless browser no servidor, e o que se
 * quer aqui é conferir o que o cliente vai ver. O quadro é inerte
 * (`pointer-events-none`) para ninguém rolar ou clicar dentro da miniatura.
 */
export function AstroActionResultCard({
  payload,
}: {
  payload: AstroActionDonePayload;
}) {
  const [copied, setCopied] = useState(false);
  const previewable = hasPreviewablePage(payload);

  const copyLink = async () => {
    if (!previewable) return;
    try {
      await navigator.clipboard.writeText(payload.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard negado — o botão Abrir continua servindo */
    }
  };

  return (
    <div className="rounded-2xl border border-line/70 bg-card/60 overflow-hidden">
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-info/15">
          <FileText className="h-3.5 w-3.5 text-info" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{payload.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {payload.description}
          </p>
        </div>
      </div>

      {previewable ? (
        <>
          {/* 3:4 — proporção de página, para a miniatura parecer o documento. */}
          <div className="relative mx-3.5 aspect-[3/4] overflow-hidden rounded-xl border border-line/60 bg-white">
            <iframe
              src={payload.publicUrl}
              title={`Prévia de ${payload.title}`}
              loading="lazy"
              // A página pública é larga; encolhemos mantendo o enquadramento
              // do topo, que é onde ficam cabeçalho e valores.
              className="pointer-events-none absolute left-0 top-0 h-[250%] w-[250%] origin-top-left scale-[0.4] border-0"
            />
          </div>

          <div className="flex items-center gap-2 px-3.5 py-3">
            <button
              type="button"
              onClick={copyLink}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                copied
                  ? "bg-success/15 text-success"
                  : "bg-info/15 text-info hover:bg-info/25",
              )}
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Link copiado" : "Copiar link do cliente"}
            </button>

            <a
              href={payload.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-card"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir
            </a>

            {payload.internalUrl ? (
              <a
                href={payload.internalUrl}
                className="ml-auto text-xs text-muted-foreground hover:text-muted-foreground"
              >
                Editar no {payload.appName}
              </a>
            ) : null}
          </div>
        </>
      ) : payload.internalUrl ? (
        // Sem página pública ainda há destino: criar algo e não oferecer o
        // caminho até ele obriga o usuário a procurar o que acabou de pedir.
        <div className="px-3.5 pb-3">
          <a
            href={payload.internalUrl}
            className="inline-flex items-center gap-1.5 rounded-lg bg-info/15 px-2.5 py-1.5 text-xs font-medium text-info transition-colors hover:bg-info/25"
          >
            <ExternalLink className="h-3 w-3" />
            {payload.openLabel ?? `Abrir no ${payload.appName}`}
          </a>
        </div>
      ) : null}
    </div>
  );
}
