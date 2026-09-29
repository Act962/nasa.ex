"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildInstallSnippet } from "../utils/site-status";

/** Snippet de instalação com botão copiar (spec 0031, RF-3 e CB-4). */
export function InstallSnippet({ publicKey }: { publicKey: string }) {
  const [appOrigin, setAppOrigin] = useState("");
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  const snippet = appOrigin ? buildInstallSnippet(appOrigin, publicKey) : "";

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet);
    setHasCopied(true);
    toast.success("Código copiado");
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Copie o código abaixo.</li>
        <li>
          Cole antes de <code className="rounded bg-muted px-1">&lt;/body&gt;</code> em todas as páginas do site
          (no WordPress, use um plugin de &quot;inserir código no rodapé&quot;).
        </li>
        <li>Abra o site num dos domínios cadastrados: o ASTRO aparece no canto.</li>
      </ol>
      <div className="relative">
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border bg-zinc-950 p-4 pr-14 font-mono text-xs text-zinc-100">
          {snippet}
        </pre>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute right-2 top-2"
          onClick={copySnippet}
          disabled={!snippet}
          aria-label="Copiar código"
        >
          {hasCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Site com política de segurança (CSP) restrita? Libere <code className="rounded bg-muted px-1">{appOrigin}</code> em{" "}
        <code className="rounded bg-muted px-1">script-src</code>, <code className="rounded bg-muted px-1">connect-src</code> e{" "}
        <code className="rounded bg-muted px-1">img-src</code>.
      </p>
    </div>
  );
}
