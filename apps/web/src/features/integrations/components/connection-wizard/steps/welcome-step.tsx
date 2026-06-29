"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Facebook } from "lucide-react";
import { useConnectionWizardStore } from "@/features/integrations/store/connection-wizard-store";
import { PermissionExplainer } from "../permission-explainer";

export function WelcomeStep() {
  const provider = useConnectionWizardStore((s) => s.provider);
  const setStep = useConnectionWizardStore((s) => s.setStep);

  if (!provider) return null;

  const providerLabel = provider === "meta" ? "Facebook" : "Google";
  const providerIcon = provider === "meta" ? Facebook : Facebook;

  const handleConnect = () => {
    if (typeof window === "undefined") return;
    setStep("authorize");
    const returnUrl = window.location.pathname + window.location.search;
    const startPath = provider === "meta" ? "/api/oauth/meta/start" : "/api/oauth/google/start";
    window.location.href = `${startPath}?returnUrl=${encodeURIComponent(returnUrl)}`;
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          Conectar com {providerLabel}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Você vai ser redirecionado para o {providerLabel} autorizar o NASA. Em seguida, escolhe quais contas quer conectar.
        </p>
      </div>

      <PermissionExplainer provider={provider} />

      <Button
        onClick={handleConnect}
        size="lg"
        className="w-full gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold"
      >
        {(() => {
          const Icon = providerIcon;
          return <Icon className="size-4" />;
        })()}
        Conectar com {providerLabel}
        <ArrowRight className="size-4 ml-auto" />
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        Você revisa e aprova antes de qualquer acesso. Token criptografado, conexão por OAuth oficial.
      </p>
    </div>
  );
}
