"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useConnectionWizardStore } from "@/features/integrations/store/connection-wizard-store";

export function AuthorizeStep() {
  const provider = useConnectionWizardStore((s) => s.provider);
  const setStep = useConnectionWizardStore((s) => s.setStep);

  const retry = () => {
    if (typeof window === "undefined" || !provider) return;
    const returnUrl = window.location.pathname + window.location.search;
    const startPath = provider === "meta" ? "/api/oauth/meta/start" : "/api/oauth/google/start";
    window.location.href = `${startPath}?returnUrl=${encodeURIComponent(returnUrl)}`;
  };

  return (
    <div className="space-y-6 text-center py-6">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#7C3AED]/10">
        <Loader2 className="size-8 text-[#7C3AED] animate-spin" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Aguardando autorização…</h2>
        <p className="text-sm text-muted-foreground">
          Conclua o processo na janela {provider === "meta" ? "do Facebook" : "do Google"} para continuar.
        </p>
      </div>
      <div className="space-y-2 pt-2">
        <p className="text-xs text-muted-foreground">A janela não abriu?</p>
        <Button variant="outline" onClick={retry} size="sm">
          Tentar de novo
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setStep("welcome")}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
