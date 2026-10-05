"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import {
  useDisconnectSocialAccount,
  useReactivateSocialAccount,
  useRecheckSocialAccountCapabilities,
  useRepairSocialAccountSubscription,
  type SocialAccount,
} from "../hooks/use-social-accounts";
import type { GuideTargetAccount } from "./instagram-connect-guide-dialog";

const STATUS_LABEL: Record<SocialAccount["status"], string> = {
  ACTIVE: "Ativa",
  NEEDS_RECONNECT: "Reconectar",
  DISABLED: "Desativada",
};

const STATUS_DOT_CLASS: Record<SocialAccount["status"], string> = {
  ACTIVE: "bg-success",
  NEEDS_RECONNECT: "bg-destructive",
  DISABLED: "bg-muted-foreground",
};

export function socialAccountLabel(account: SocialAccount): string {
  return account.handle ? `@${account.handle}` : account.externalAccountId;
}

function CapabilityChip({ label, capability }: { label: string; capability: boolean | null }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px]",
        capability === true && "bg-success/10 text-success",
        capability === false && "bg-warning/10 text-warning",
        capability === null && "bg-knob text-muted-foreground",
      )}
    >
      {capability === false ? `não ${label}` : label}
      {capability === null && " · a conferir"}
    </span>
  );
}

function AccountFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-panel px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

function AppChip({ label, isOn }: { label: string; isOn: boolean }) {
  return (
    <span className={cn("rounded-full bg-panel px-2.5 py-0.5 text-xs", isOn ? "text-foreground" : "text-muted-foreground")}>
      {label}
    </span>
  );
}

/** Cartão de uma conta conectada (spec 0069): estado, dados e ações, igual nos Satélites e no Comments. */
export function SocialAccountCard({
  account,
  canManage,
  isSelected = false,
  showOpenInComments = false,
  onOpenGuide,
  extra,
}: {
  account: SocialAccount;
  canManage: boolean;
  /** Conta em uso na tela que mostra o cartão (ex.: a selecionada no Comments). */
  isSelected?: boolean;
  showOpenInComments?: boolean;
  onOpenGuide: (startAt: GuideTargetAccount["startAt"]) => void;
  extra?: ReactNode;
}) {
  const disconnect = useDisconnectSocialAccount();
  const repair = useRepairSocialAccountSubscription();
  const reactivate = useReactivateSocialAccount();
  const recheck = useRecheckSocialAccountCapabilities();
  const needsReconnect = account.status === "NEEDS_RECONNECT";
  const isDisabled = account.status === "DISABLED";
  const isActive = account.status === "ACTIVE";
  const isMetaLogin = account.authMode === "META_LOGIN";
  const accountLabel = socialAccountLabel(account);

  return (
    <article className={cn("space-y-3.5 rounded-[24px] bg-card p-4", isSelected && "ring-1 ring-primary/50")}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-full p-0.5", isDisabled ? "bg-knob" : "bg-brand-instagram")}>
          <span className="grid size-full place-items-center rounded-full bg-panel text-base font-bold uppercase">
            {(account.handle ?? "@").charAt(0)}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold">{accountLabel}</h3>
          <p className="text-xs text-muted-foreground">
            {isMetaLogin ? "Conectada pela Meta da empresa" : "Conectada pelo passo a passo"}
          </p>
        </div>
        {isSelected && <span className="rounded-full bg-knob px-2.5 py-0.5 text-xs">Em uso aqui</span>}
        <span className={cn("flex items-center gap-1.5 rounded-full bg-knob px-2.5 py-0.5 text-xs", needsReconnect && "text-destructive")}>
          <span className={cn("size-1.5 rounded-full", STATUS_DOT_CLASS[account.status])} />
          {STATUS_LABEL[account.status]}
        </span>
      </div>

      {needsReconnect && (
        <div className="flex gap-2.5 rounded-[14px] bg-destructive/10 px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            <span className="font-medium">A Meta recusou a credencial.</span>{" "}
            <span className="text-muted-foreground">
              {account.lastErrorMessage ??
                (isMetaLogin ? "Reconecte a Meta nos Satélites." : "Gere um novo token e troque a credencial.")}
            </span>
          </p>
        </div>
      )}

      {isDisabled && (
        <div className="flex gap-2.5 rounded-[14px] bg-panel px-3 py-2.5 text-sm">
          <PauseCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p>
            <span className="font-medium">Conta desativada.</span>{" "}
            <span className="text-muted-foreground">
              As automações e o histórico foram preservados, e a URL do webhook continua a mesma. Reative para voltar a responder.
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <AccountFact label="ID da conta" value={account.externalAccountId} />
        <AccountFact label="Token" value={isMetaLogin ? "Da conexão da Meta" : `••••${account.accessTokenLast4}`} />
        <AccountFact
          label="Automações"
          value={account.automationCount > 0 ? `${account.automationCount} no Comments` : "Nenhuma"}
        />
        {!isMetaLogin && (
          <AccountFact
            label="Validade do token"
            value={account.credentialsExpiresAt ? `até ${new Date(account.credentialsExpiresAt).toLocaleDateString("pt-BR")} · renova sozinho` : "A conferir · renova sozinho"}
          />
        )}
      </div>

      {!isDisabled && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Esta conta:</span>
          <CapabilityChip label="responde comentários e directs" capability />
          <CapabilityChip label="publica pelo Planner" capability={account.canPublish} />
          <CapabilityChip label="lê métricas" capability={account.canReadInsights} />
          {canManage && (
            <button
              type="button"
              disabled={recheck.isPending}
              onClick={() => recheck.mutate({ channelId: account.id }, { onSuccess: () => toast.success("Permissões conferidas."), onError: (error) => toast.error(error.message) })}
              className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
            >
              {recheck.isPending ? "conferindo…" : "conferir de novo"}
            </button>
          )}
        </div>
      )}

      {!isDisabled && account.canPublish === false && (
        <p className="rounded-[14px] bg-warning/10 px-3 py-2.5 text-xs">
          <span className="font-medium">Falta a permissão de publicar.</span>{" "}
          <span className="text-muted-foreground">
            {isMetaLogin
              ? "A conexão da Meta desta empresa não pediu a permissão de publicação."
              : "No app da Meta, adicione instagram_business_content_publish ao caso de uso do Instagram, gere um token novo e troque a credencial."}
          </span>
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Kit da marca: <span className="font-medium text-foreground">{account.brandKitName ?? "Padrão da empresa"}</span>
        {canManage && (
          <>
            {" · "}
            <Link href={`/nasa-planner?tab=kit&org=${account.organizationId}${account.brandKitId ? `&kit=${account.brandKitId}` : ""}`} className="underline">
              trocar no Planner
            </Link>
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <AppChip label="Comments" isOn={isActive} />
        {/* Só conta conectada pela Meta vira lead no chat (spec 0062). */}
        <AppChip label={isMetaLogin ? "Chat" : "Chat · só pela Meta"} isOn={isActive && isMetaLogin} />
        <AppChip label="Planner · em breve" isOn={false} />
      </div>

      {extra}

      {(canManage || showOpenInComments) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
          {canManage && isDisabled && (
            <Button
              size="sm"
              disabled={reactivate.isPending}
              onClick={() =>
                reactivate.mutate(
                  { channelId: account.id },
                  {
                    onSuccess: (result) =>
                      result.subscribed
                        ? toast.success("Conta reativada")
                        : toast.warning("Reativada, mas a inscrição nos eventos falhou"),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              {reactivate.isPending && <OrbitaSpinner className="size-4" />}
              Reativar
            </Button>
          )}

          {showOpenInComments && !isDisabled && (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/comments?conta=${account.id}`}>Abrir no Comments</Link>
            </Button>
          )}

          {canManage && !isMetaLogin && (
            <>
              <Button size="sm" variant="secondary" onClick={() => onOpenGuide("webhook")}>
                Ver dados do webhook
              </Button>
              <Button size="sm" variant={needsReconnect ? "default" : "secondary"} onClick={() => onOpenGuide("keys")}>
                Trocar credencial
              </Button>
            </>
          )}

          {canManage && !isDisabled && (
            <Button
              size="sm"
              variant="secondary"
              disabled={repair.isPending}
              onClick={() =>
                repair.mutate(
                  { channelId: account.id },
                  {
                    onSuccess: (result) =>
                      result.subscribed
                        ? toast.success(`Recebendo: ${result.fields.join(", ") || "nenhum campo"}`)
                        : toast.error(result.error ?? "Não foi possível inscrever"),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              {repair.isPending && <OrbitaSpinner className="size-4" />}
              Reenviar inscrição
            </Button>
          )}

          {canManage && !isDisabled && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-muted-foreground"
              disabled={disconnect.isPending}
              onClick={() =>
                disconnect.mutate(
                  { channelId: account.id },
                  {
                    onSuccess: () => toast.success(`${accountLabel} desativada`),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              Desativar
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
