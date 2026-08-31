"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyLinkWithUtm } from "@/components/ui/copy-link-with-utm";

/**
 * Link público do trafeGO para a equipe divulgar. É a porta de entrada do
 * cliente externo — não existe menu para ela dentro da plataforma, então este
 * card é o lugar de onde a equipe copia e compartilha.
 *
 * O `proxy.ts` já casa `/trafego/:path*`, então UTM e `?ref=` de parceiro são
 * capturados em cookie e sobrevivem até a criação do lead.
 */
export function TrafegoPublicLinkCard() {
  const [baseUrl, setBaseUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setBaseUrl(`${window.location.origin}/trafego`);
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(baseUrl);
      setCopied(true);
      toast.success("Link copiado.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <div className="rounded-lg border p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Share2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Link para divulgar</h2>
          <p className="text-sm text-muted-foreground">
            É por aqui que o cliente contrata sozinho. Use em anúncio, bio ou
            WhatsApp — a origem é registrada e chega junto com o lead.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-xs">
              {baseUrl || "carregando…"}
            </code>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopy}
              disabled={!baseUrl}
            >
              {copied ? (
                <Check className="mr-1.5 size-4 text-emerald-500" />
              ) : (
                <Copy className="mr-1.5 size-4" />
              )}
              Copiar
            </Button>

            {baseUrl && (
              <CopyLinkWithUtm
                baseUrl={baseUrl}
                size="sm"
                trigger={
                  <Button type="button" size="sm" variant="outline">
                    <Share2 className="mr-1.5 size-4" />
                    Copiar com UTM
                  </Button>
                }
              />
            )}

            <Button asChild size="sm" variant="ghost">
              <a href="/trafego" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 size-4" />
                Abrir
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
