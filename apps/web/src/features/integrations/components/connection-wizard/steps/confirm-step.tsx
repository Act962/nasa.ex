"use client";

import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { client } from "@/lib/orpc";
import { useConnectionWizardStore } from "@/features/integrations/store/connection-wizard-store";

export function ConfirmStep() {
  const provider = useConnectionWizardStore((s) => s.provider);
  const oauthSessionId = useConnectionWizardStore((s) => s.oauthSessionId);
  const selected = useConnectionWizardStore((s) => s.selected);
  const isFinalizing = useConnectionWizardStore((s) => s.isFinalizing);
  const setFinalizing = useConnectionWizardStore((s) => s.setFinalizing);
  const setError = useConnectionWizardStore((s) => s.setError);
  const finish = useConnectionWizardStore((s) => s.finish);
  const setStep = useConnectionWizardStore((s) => s.setStep);

  const summaryItems: { label: string; value: number }[] = [];
  if (provider === "meta") {
    summaryItems.push({ label: "Contas de anúncios", value: selected.adAccountIds.length });
    summaryItems.push({ label: "Páginas Facebook", value: selected.pageIds.length });
    summaryItems.push({ label: "Contas Instagram", value: selected.igAccountIds.length });
  } else {
    summaryItems.push({ label: "Contas Google Ads", value: selected.googleCustomerIds.length });
  }

  const handleFinalize = async () => {
    if (!provider || !oauthSessionId) {
      setError("Sessão OAuth ausente. Reinicie o processo.");
      return;
    }
    setFinalizing(true);
    try {
      await client.integrations.oauthFinalize({
        oauthSessionId,
        provider,
        selectedAdAccountIds: selected.adAccountIds,
        selectedPageIds: selected.pageIds,
        selectedIgAccountIds: selected.igAccountIds,
        selectedGoogleCustomerIds: selected.googleCustomerIds,
      });
      toast.success(`${provider === "meta" ? "Meta" : "Google"} conectado com sucesso!`);
      finish();
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("oauth_session");
        url.searchParams.delete("oauth_provider");
        url.searchParams.delete("oauth_step");
        window.history.replaceState({}, "", url.toString());
        window.location.reload();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao salvar conexão";
      setError(msg);
      toast.error(msg);
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Pronto para conectar</h2>
        <p className="text-sm text-muted-foreground">Revise abaixo e confirme.</p>
      </div>

      <ul className="space-y-2 rounded-lg border border-border/60 bg-card p-3">
        {summaryItems.map((it) => (
          <li key={it.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{it.label}</span>
            <span className="font-medium tabular-nums">{it.value}</span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setStep("select")}
          disabled={isFinalizing}
          className="flex-1"
        >
          Voltar
        </Button>
        <Button
          onClick={handleFinalize}
          disabled={isFinalizing}
          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isFinalizing ? (
            <><Loader2 className="size-4 animate-spin" /> Conectando…</>
          ) : (
            <><CheckCircle2 className="size-4" /> Conectar agora</>
          )}
        </Button>
      </div>
    </div>
  );
}
