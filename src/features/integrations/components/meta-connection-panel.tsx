"use client";

import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { useMetaConnectionStatus, useTestMetaConnection } from "../hooks/use-meta-connection";

const DAY_MS = 24 * 60 * 60 * 1000;

function describeTokenValidity(expiresAt: string | null, neverExpires: boolean | null): string {
  if (neverExpires) return "não expira";
  if (!expiresAt) return "não verificada (informe App ID e App Secret)";
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS);
  if (daysLeft <= 0) return "vencido";
  return `expira em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`;
}

/** Resumo do "Testar conexão" da Meta nos Satélites (spec 0122, RF-9). */
export function MetaConnectionPanel() {
  const { data: status, isLoading } = useMetaConnectionStatus();
  const testConnection = useTestMetaConnection();

  if (isLoading || !status) return null;

  const check = status.check;
  const handleTest = () =>
    testConnection.mutate(
      {},
      {
        onSuccess: ({ check: result }) => {
          if (result.isOk) toast.success("Conexão com a Meta funcionando.");
          else toast.error(result.errorMessage ?? "A conexão com a Meta precisa de ajuste.");
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">Situação da conexão</p>
        {status.viewer.isManagedByOrbita && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <ShieldCheck className="size-3" /> Gerenciada pela equipe Órbita
          </Badge>
        )}
      </div>

      {!status.isConnected ? (
        <p className="text-xs text-muted-foreground">Salve o token e a conta de anúncios para testar a conexão.</p>
      ) : !check ? (
        <p className="text-xs text-muted-foreground">Ainda não testada.</p>
      ) : (
        <div className="space-y-2 text-xs">
          <p className={cn("flex items-start gap-1.5 font-medium", check.isOk ? "text-success" : "text-warning")}>
            {check.isOk ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            )}
            {check.isOk ? "Lendo os números da conta normalmente." : check.errorMessage ?? "A conexão precisa de ajuste."}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
            {check.tokenOwner && (
              <>
                <dt>Conectado como</dt>
                <dd className="text-foreground">{check.tokenOwner.name ?? check.tokenOwner.id}</dd>
              </>
            )}
            <dt>Validade do token</dt>
            <dd className="text-foreground">{describeTokenValidity(check.expiresAt, check.neverExpires)}</dd>
            {check.account && (
              <>
                <dt>Conta de anúncios</dt>
                <dd className="text-foreground">
                  {check.account.name} · {check.account.currency} · {check.account.statusLabel}
                </dd>
              </>
            )}
            {check.pages.length > 0 && (
              <>
                <dt>Página</dt>
                <dd className="text-foreground">
                  {check.pages
                    .map((page) =>
                      [
                        page.name,
                        page.instagramUsername ? `@${page.instagramUsername}` : null,
                        page.whatsappNumber ? `WhatsApp ${page.whatsappNumber}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    )
                    .join(" | ")}
                </dd>
              </>
            )}
            <dt>Criar campanhas</dt>
            <dd className="text-foreground">
              {check.canCreate
                ? "liberado"
                : check.missingForCreate.length > 0
                  ? `falta permissão: ${check.missingForCreate.join(", ")}`
                  : check.account && check.pages.length === 0
                    ? "nenhuma página atribuída a esta conta"
                    : "não liberado"}
            </dd>
          </dl>
          <p className="text-[11px] text-muted-foreground">
            Testado em {new Date(check.checkedAt).toLocaleString("pt-BR")}
          </p>
        </div>
      )}

      {status.isConnected && status.viewer.canTest && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full gap-1.5"
          onClick={handleTest}
          disabled={testConnection.isPending}
        >
          {testConnection.isPending ? <OrbitaSpinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
          Testar conexão
        </Button>
      )}
    </div>
  );
}
