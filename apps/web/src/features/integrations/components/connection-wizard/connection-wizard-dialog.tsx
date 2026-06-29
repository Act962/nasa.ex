"use client";

import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConnectionWizardStore, type WizardStep } from "@/features/integrations/store/connection-wizard-store";
import { WelcomeStep } from "./steps/welcome-step";
import { AuthorizeStep } from "./steps/authorize-step";
import { SelectAccountsStep } from "./steps/select-accounts-step";
import { ConfirmStep } from "./steps/confirm-step";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "welcome", label: "Bem-vindo" },
  { key: "authorize", label: "Autorizar" },
  { key: "select", label: "Selecionar" },
  { key: "confirm", label: "Confirmar" },
];

export function ConnectionWizardDialog() {
  const open = useConnectionWizardStore((s) => s.open);
  const cancel = useConnectionWizardStore((s) => s.cancel);
  const provider = useConnectionWizardStore((s) => s.provider);
  const currentStep = useConnectionWizardStore((s) => s.currentStep);
  const error = useConnectionWizardStore((s) => s.error);
  const setError = useConnectionWizardStore((s) => s.setError);
  const setOauthSessionId = useConnectionWizardStore((s) => s.setOauthSessionId);
  const setStep = useConnectionWizardStore((s) => s.setStep);
  const start = useConnectionWizardStore((s) => s.start);

  // Detecta callback OAuth via query params na URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("oauth_session");
    const oauthProvider = params.get("oauth_provider");
    const oauthStep = params.get("oauth_step");
    const oauthError = params.get("oauth_error");

    if (oauthError) {
      // Abre wizard no welcome com erro
      if (oauthProvider === "meta" || oauthProvider === "google") {
        start(oauthProvider);
      }
      setError(`Falha na autorização: ${oauthError}`);
      const url = new URL(window.location.href);
      url.searchParams.delete("oauth_error");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    if (sessionId && (oauthProvider === "meta" || oauthProvider === "google")) {
      start(oauthProvider);
      setOauthSessionId(sessionId);
      setStep((oauthStep as WizardStep) || "select");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) cancel(); }}>
      <DialogContent className="max-w-lg gap-0 p-0 sm:max-w-lg overflow-hidden">
        <DialogHeader className="border-b border-border/60 p-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            {provider === "meta" ? "Conectar Meta" : provider === "google" ? "Conectar Google" : "Conectar"}
          </DialogTitle>
          <div className="flex items-center gap-1.5 pt-2">
            {STEPS.map((s, idx) => (
              <div
                key={s.key}
                className={`h-1.5 flex-1 rounded-full transition ${
                  idx <= stepIndex ? "bg-[#7C3AED]" : "bg-muted"
                }`}
                aria-label={s.label}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="p-5">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-300">
              <div className="flex items-start justify-between gap-2">
                <span className="leading-relaxed">{error}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setError(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}

          {currentStep === "welcome" && <WelcomeStep />}
          {currentStep === "authorize" && <AuthorizeStep />}
          {currentStep === "select" && (
            <div className="space-y-4">
              <SelectAccountsStep />
              <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                <Button variant="ghost" onClick={cancel}>Cancelar</Button>
                <Button onClick={() => setStep("confirm")} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
                  Continuar
                </Button>
              </div>
            </div>
          )}
          {currentStep === "confirm" && <ConfirmStep />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
