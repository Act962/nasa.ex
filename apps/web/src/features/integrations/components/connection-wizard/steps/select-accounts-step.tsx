"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertCircle } from "lucide-react";
import { orpc } from "@/lib/orpc";
import { useConnectionWizardStore } from "@/features/integrations/store/connection-wizard-store";

export function SelectAccountsStep() {
  const provider = useConnectionWizardStore((s) => s.provider);
  const oauthSessionId = useConnectionWizardStore((s) => s.oauthSessionId);
  const selected = useConnectionWizardStore((s) => s.selected);
  const toggleAdAccount = useConnectionWizardStore((s) => s.toggleAdAccount);
  const togglePage = useConnectionWizardStore((s) => s.togglePage);
  const toggleIgAccount = useConnectionWizardStore((s) => s.toggleIgAccount);
  const toggleGoogleCustomer = useConnectionWizardStore((s) => s.toggleGoogleCustomer);
  const setSelectedAdAccounts = useConnectionWizardStore((s) => s.setSelectedAdAccounts);
  const setSelectedPages = useConnectionWizardStore((s) => s.setSelectedPages);
  const setSelectedIgAccounts = useConnectionWizardStore((s) => s.setSelectedIgAccounts);
  const setSelectedGoogleCustomers = useConnectionWizardStore((s) => s.setSelectedGoogleCustomers);
  const setStep = useConnectionWizardStore((s) => s.setStep);

  const statusQuery = useQuery({
    ...orpc.integrations.getConnectionStatus.queryOptions({
      input: { oauthSessionId: oauthSessionId ?? undefined },
    }),
    enabled: Boolean(oauthSessionId),
  });

  const pendingMeta = statusQuery.data?.pendingMeta as
    | { adAccounts: { id: string; account_id: string; name: string; currency: string | null }[]; pages: { id: string; name: string; category: string | null; hasInstagram: boolean }[]; igAccounts: { id: string; username?: string; name?: string; page_id: string }[]; fbUser: { id: string; name: string } }
    | null
    | undefined;

  const pendingGoogle = statusQuery.data?.pendingGoogle as
    | { adsCustomers: { id: string; resourceName: string }[]; googleUser: { sub: string; email?: string; name?: string } }
    | null
    | undefined;

  const initialized = useMemo(() => {
    if (provider === "meta" && pendingMeta) {
      return {
        adAccountIds: pendingMeta.adAccounts.map((a) => a.account_id || a.id),
        pageIds: pendingMeta.pages.map((p) => p.id),
        igAccountIds: pendingMeta.igAccounts.map((i) => i.id),
        googleCustomerIds: [] as string[],
      };
    }
    if (provider === "google" && pendingGoogle) {
      return {
        adAccountIds: [] as string[],
        pageIds: [] as string[],
        igAccountIds: [] as string[],
        googleCustomerIds: pendingGoogle.adsCustomers.map((c) => c.id),
      };
    }
    return null;
  }, [provider, pendingMeta, pendingGoogle]);

  useEffect(() => {
    if (!initialized) return;
    if (selected.adAccountIds.length === 0 && initialized.adAccountIds.length > 0) {
      setSelectedAdAccounts(initialized.adAccountIds);
    }
    if (selected.pageIds.length === 0 && initialized.pageIds.length > 0) {
      setSelectedPages(initialized.pageIds);
    }
    if (selected.igAccountIds.length === 0 && initialized.igAccountIds.length > 0) {
      setSelectedIgAccounts(initialized.igAccountIds);
    }
    if (selected.googleCustomerIds.length === 0 && initialized.googleCustomerIds.length > 0) {
      setSelectedGoogleCustomers(initialized.googleCustomerIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  if (statusQuery.isLoading || !statusQuery.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="size-6 animate-spin text-[#7C3AED]" />
        <p className="text-sm text-muted-foreground">Buscando suas contas…</p>
      </div>
    );
  }

  if (provider === "meta" && !pendingMeta) {
    return (
      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:bg-amber-950/30 dark:border-amber-900/50">
        <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
          <AlertCircle className="size-4" />
          Sessão expirada ou inválida
        </div>
        <p className="text-amber-700 dark:text-amber-300">
          Vamos precisar reiniciar o processo. Volte ao início.
        </p>
        <Button variant="outline" size="sm" onClick={() => setStep("welcome")}>
          Voltar ao início
        </Button>
      </div>
    );
  }

  if (provider === "google" && !pendingGoogle) {
    return (
      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:bg-amber-950/30 dark:border-amber-900/50">
        <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
          <AlertCircle className="size-4" />
          Sessão expirada
        </div>
        <Button variant="outline" size="sm" onClick={() => setStep("welcome")}>
          Voltar ao início
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
      {provider === "meta" && pendingMeta && (
        <>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 text-sm">
            <span className="font-medium">Olá, {pendingMeta.fbUser.name}!</span>{" "}
            <span className="text-muted-foreground">Selecione o que conectar:</span>
          </div>

          {pendingMeta.adAccounts.length > 0 && (
            <Section title="Contas de anúncios" count={pendingMeta.adAccounts.length}>
              {pendingMeta.adAccounts.map((a) => {
                const id = a.account_id || a.id;
                return (
                  <Row
                    key={id}
                    checked={selected.adAccountIds.includes(id)}
                    onToggle={() => toggleAdAccount(id)}
                    title={a.name}
                    subtitle={`${id}${a.currency ? ` · ${a.currency}` : ""}`}
                  />
                );
              })}
            </Section>
          )}

          {pendingMeta.pages.length > 0 && (
            <Section title="Páginas do Facebook" count={pendingMeta.pages.length}>
              {pendingMeta.pages.map((p) => (
                <Row
                  key={p.id}
                  checked={selected.pageIds.includes(p.id)}
                  onToggle={() => togglePage(p.id)}
                  title={p.name}
                  subtitle={[p.category, p.hasInstagram ? "tem Instagram" : null].filter(Boolean).join(" · ") || "Página"}
                />
              ))}
            </Section>
          )}

          {pendingMeta.igAccounts.length > 0 && (
            <Section title="Contas Instagram Business" count={pendingMeta.igAccounts.length}>
              {pendingMeta.igAccounts.map((i) => (
                <Row
                  key={i.id}
                  checked={selected.igAccountIds.includes(i.id)}
                  onToggle={() => toggleIgAccount(i.id)}
                  title={i.name || i.username || "Instagram"}
                  subtitle={i.username ? `@${i.username}` : i.id}
                />
              ))}
            </Section>
          )}
        </>
      )}

      {provider === "google" && pendingGoogle && (
        <>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 text-sm">
            <span className="font-medium">Olá, {pendingGoogle.googleUser.name || pendingGoogle.googleUser.email}!</span>
          </div>
          {pendingGoogle.adsCustomers.length > 0 ? (
            <Section title="Contas Google Ads" count={pendingGoogle.adsCustomers.length}>
              {pendingGoogle.adsCustomers.map((c) => (
                <Row
                  key={c.id}
                  checked={selected.googleCustomerIds.includes(c.id)}
                  onToggle={() => toggleGoogleCustomer(c.id)}
                  title={c.id}
                  subtitle={c.resourceName}
                />
              ))}
            </Section>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma conta Google Ads vinculada ao seu usuário foi encontrada. Você ainda pode usar Gmail e outras integrações.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ checked, onToggle, title, subtitle }: { checked: boolean; onToggle: () => void; title: string; subtitle?: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5 text-left transition hover:bg-accent"
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} className="pointer-events-none" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
