"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangleIcon,
  CalendarIcon,
  CheckCircle2,
  Clock,
  CopyIcon,
  ExternalLinkIcon,
  RotateCw,
  ShieldOff,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCountdown } from "@/features/public-calendar/hooks/use-countdown";

/**
 * Seção em Configurações > Empresa > Geral. Controla o compartilhamento
 * público do Calendário Workspace via link com expiração de 1h.
 *
 * Estados:
 *   - desativado: toggle OFF → clique abre disclaimer → enable
 *   - ativo + válido: mostra URL, contador colorido, "Rotacionar" e "Desativar"
 *   - ativo + expirado: estado degradado → botão "Gerar novo link"
 */
export function CalendarShareSection() {
  const qc = useQueryClient();
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);

  const statusQ = useQuery({
    ...orpc.orgs.getCalendarShareStatus.queryOptions(),
    refetchInterval: 30_000,
  });

  const status = statusQ.data;
  const countdown = useCountdown(status?.expiresAt ?? null);

  const enableMutation = useMutation(
    orpc.orgs.enableCalendarShare.mutationOptions({
      onSuccess: () => {
        toast.success("Compartilhamento ativado");
        qc.invalidateQueries({ queryKey: orpc.orgs.getCalendarShareStatus.queryKey() });
        setShowEnableDialog(false);
      },
      onError: (err: any) => toast.error(err?.message ?? "Falha ao ativar"),
    }),
  );

  const disableMutation = useMutation(
    orpc.orgs.disableCalendarShare.mutationOptions({
      onSuccess: () => {
        toast.success("Compartilhamento desativado");
        qc.invalidateQueries({ queryKey: orpc.orgs.getCalendarShareStatus.queryKey() });
        setShowDisableDialog(false);
      },
      onError: (err: any) => toast.error(err?.message ?? "Falha ao desativar"),
    }),
  );

  const rotateMutation = useMutation(
    orpc.orgs.rotateCalendarShareToken.mutationOptions({
      onSuccess: () => {
        toast.success("Novo link gerado");
        qc.invalidateQueries({ queryKey: orpc.orgs.getCalendarShareStatus.queryKey() });
        setShowRotateDialog(false);
      },
      onError: (err: any) => toast.error(err?.message ?? "Falha ao rotacionar"),
    }),
  );

  const copyUrl = async () => {
    if (!status?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(status.shareUrl);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar — copie manualmente");
    }
  };

  // Estados derivados pro UI
  const isActiveAndValid = !!status?.shareUrl && !status?.expired;
  const isActiveButExpired = !!status?.enabled && !!status?.expired;
  const isOff = !status?.enabled;

  // Cor do badge de expiração
  const badgeClass = countdown.expired
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : countdown.msLeft < 10 * 60_000
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : countdown.msLeft < 30 * 60_000
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-success/15 text-success border-success/30";

  return (
    <>
      <section className="rounded-[20px] border border-line bg-card p-4 sm:p-5">
        <header className="mb-4 flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-info/15 text-info">
            <CalendarIcon className="size-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">
              Compartilhamento público do Calendário
            </h3>
            <p className="text-xs text-muted-foreground">
              Gere um link público pra qualquer pessoa ver o calendário
              consolidado da empresa. Link expira em 1 hora.
            </p>
          </div>
          {!statusQ.isLoading && (
            <Switch
              checked={!!status?.enabled}
              disabled={enableMutation.isPending || disableMutation.isPending}
              onCheckedChange={(next) => {
                if (next) setShowEnableDialog(true);
                else setShowDisableDialog(true);
              }}
            />
          )}
        </header>

        {statusQ.isLoading ? (
          <div className="flex items-center justify-center py-6">
            <OrbitaSpinner className="size-4 text-muted-foreground" />
          </div>
        ) : isActiveAndValid && status?.shareUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={status.shareUrl}
                readOnly
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyUrl}
                className="shrink-0"
              >
                <CopyIcon className="size-3.5" />
                Copiar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                asChild
                className="shrink-0"
              >
                <a
                  href={status.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
                  badgeClass,
                )}
                title={
                  status.expiresAt
                    ? `Expira em ${new Date(status.expiresAt).toLocaleString("pt-BR")}`
                    : ""
                }
              >
                <Clock className="size-3" />
                {countdown.label}
              </span>
              {status.enabledAt && status.enabledByName && (
                <span className="text-muted-foreground">
                  Ativado em{" "}
                  {new Date(status.enabledAt).toLocaleString("pt-BR")} por{" "}
                  {status.enabledByName}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowRotateDialog(true)}
                disabled={rotateMutation.isPending}
                className="gap-1.5"
              >
                <RotateCw className="size-3.5" />
                Rotacionar link
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowDisableDialog(true)}
                disabled={disableMutation.isPending}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <ShieldOff className="size-3.5" />
                Desativar
              </Button>
            </div>
          </div>
        ) : isActiveButExpired ? (
          <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="size-4" />
              Link expirado
            </div>
            <p className="text-xs text-muted-foreground">
              O link gerado anteriormente não está mais válido. Gere um novo
              pra continuar compartilhando.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => rotateMutation.mutate({})}
                disabled={rotateMutation.isPending}
                className="gap-1.5"
              >
                {rotateMutation.isPending ? (
                  <OrbitaSpinner className="size-3.5 " />
                ) : (
                  <RotateCw className="size-3.5" />
                )}
                Gerar novo link
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowDisableDialog(true)}
                disabled={disableMutation.isPending}
              >
                Desativar
              </Button>
            </div>
          </div>
        ) : isOff ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="mb-1 inline size-3.5 text-success" />{" "}
            Calendário não está sendo compartilhado publicamente. Ative o
            toggle acima pra gerar um link.
          </div>
        ) : null}
      </section>

      {/* Disclaimer pra ATIVAR */}
      <AlertDialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="size-5 text-warning" />
              Compartilhar calendário publicamente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm leading-relaxed">
              <span className="block">
                Ao ativar, qualquer pessoa com o link poderá ver os eventos dos
                seus workspaces.
              </span>
              <span className="block">
                <strong className="text-foreground">Visitantes não logados</strong>{" "}
                veem apenas título, datas e horário.
                <strong className="text-foreground"> Membros logados</strong>{" "}
                da sua empresa veem detalhes completos.
              </span>
              <span className="block rounded-md bg-warning/10 px-2 py-1.5 text-warning">
                <Clock className="mr-1 inline size-3" />O link expira em{" "}
                <strong>1 hora</strong>. Você precisa rotacionar ou recompartilhar
                pra estender. Pode desativar a qualquer momento.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enableMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={enableMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                enableMutation.mutate({ consent: true });
              }}
            >
              {enableMutation.isPending ? (
                <OrbitaSpinner className="mr-1 size-3.5 " />
              ) : null}
              Sim, ativar compartilhamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm pra DESATIVAR */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldOff className="size-5 text-destructive" />
              Desativar compartilhamento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Qualquer pessoa que tenha o link atual perderá acesso imediato
              ao calendário. Você pode reativar depois, mas será necessário
              gerar e compartilhar um novo link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disableMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={disableMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                disableMutation.mutate({});
              }}
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/40"
            >
              {disableMutation.isPending ? (
                <OrbitaSpinner className="mr-1 size-3.5 " />
              ) : null}
              Sim, desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm pra ROTACIONAR */}
      <AlertDialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCw className="size-5 text-info" />
              Rotacionar link
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              O link atual ficará inválido imediatamente. Um novo link válido
              por 1 hora será gerado em seguida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotateMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={rotateMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                rotateMutation.mutate({});
              }}
            >
              {rotateMutation.isPending ? (
                <OrbitaSpinner className="mr-1 size-3.5 " />
              ) : null}
              Sim, gerar novo link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

