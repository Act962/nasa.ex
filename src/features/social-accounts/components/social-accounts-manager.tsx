"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Instagram,
  KeyRound,
  Link2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import {
  useDisconnectSocialAccount,
  useReactivateSocialAccount,
  useRepairSocialAccountSubscription,
  useSocialAccounts,
  type SocialAccount,
} from "../hooks/use-social-accounts";
import { InstagramConnectGuideDialog, type GuideTargetAccount } from "./instagram-connect-guide-dialog";
import { MetaConnectOption } from "./meta-connect-option";

const STATUS_LABEL: Record<SocialAccount["status"], string> = {
  ACTIVE: "Ativa",
  NEEDS_RECONNECT: "Reconectar",
  DISABLED: "Desativada",
};

const STATUS_BADGE_VARIANT: Record<SocialAccount["status"], "secondary" | "destructive" | "outline"> = {
  ACTIVE: "secondary",
  NEEDS_RECONNECT: "destructive",
  DISABLED: "outline",
};

type GuideState = { isOpen: false } | { isOpen: true; targetAccount?: GuideTargetAccount };

/**
 * Contas do Instagram da organização (spec 0069): a mesma lista nos Satélites e no Comments.
 * `renderAccountExtra` deixa quem usa acrescentar o que é só seu (ex.: tracking de leads do Comments).
 */
export function SocialAccountsManager({
  selectedAccountId,
  onAccountConnected,
  renderAccountExtra,
  className,
}: {
  selectedAccountId?: string | null;
  onAccountConnected?: (accountId: string) => void;
  renderAccountExtra?: (account: SocialAccount) => ReactNode;
  className?: string;
}) {
  const { data, isLoading } = useSocialAccounts();
  const [guide, setGuide] = useState<GuideState>({ isOpen: false });

  if (isLoading || !data) {
    return (
      <p className={cn("flex items-center gap-2 py-6 text-sm text-muted-foreground", className)}>
        <OrbitaSpinner className="size-4" />
        Carregando contas...
      </p>
    );
  }

  const { accounts, canManage, limitPerProvider, hasLegacyDirectMessageIntegration } = data;
  const hasReachedLimit = accounts.length >= limitPerProvider;

  return (
    <div className={cn("space-y-4", className)}>
      {accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma conta do Instagram conectada. Conecte uma para responder comentários e directs e, depois, publicar pelo Planner.
        </p>
      )}

      {accounts.length > 0 && (
        <ul className="space-y-3">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              canManage={canManage}
              isSelected={account.id === selectedAccountId}
              onOpenGuide={(startAt) =>
                setGuide({
                  isOpen: true,
                  targetAccount: { id: account.id, externalAccountId: account.externalAccountId, startAt },
                })
              }
              extra={renderAccountExtra?.(account)}
            />
          ))}
        </ul>
      )}

      {hasLegacyDirectMessageIntegration && (
        <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Esta empresa tem uma conexão antiga de Instagram DM. Ela continua recebendo mensagens, mas não serve ao
          Comments nem ao Planner. Adicione a conta pelo passo a passo para usar em todos os apps.
        </p>
      )}

      {canManage ? (
        <div className="space-y-3">
          <MetaConnectOption
            connectedExternalAccountIds={accounts.map((account) => account.externalAccountId)}
            onConnected={onAccountConnected}
          />
          <Button
            variant="outline"
            disabled={hasReachedLimit}
            data-guide={GUIDE_ANCHORS.commentsConnectInstagram.id}
            onClick={() => setGuide({ isOpen: true })}
          >
            <Plus className="size-4" />
            {accounts.length === 0 ? "Conectar Instagram passo a passo" : "Adicionar conta passo a passo"}
          </Button>
          {hasReachedLimit && (
            <p className="text-xs text-muted-foreground">
              Limite de {limitPerProvider} contas atingido. Desative uma conta que não usa mais.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Só owner ou admin podem conectar e gerenciar contas.</p>
      )}

      <InstagramConnectGuideDialog
        open={guide.isOpen}
        onOpenChange={(isOpen) => !isOpen && setGuide({ isOpen: false })}
        targetAccount={guide.isOpen ? guide.targetAccount : undefined}
        onConnected={onAccountConnected}
      />
    </div>
  );
}

function AccountRow({
  account,
  canManage,
  isSelected,
  onOpenGuide,
  extra,
}: {
  account: SocialAccount;
  canManage: boolean;
  isSelected: boolean;
  onOpenGuide: (startAt: GuideTargetAccount["startAt"]) => void;
  extra?: ReactNode;
}) {
  const disconnect = useDisconnectSocialAccount();
  const repair = useRepairSocialAccountSubscription();
  const reactivate = useReactivateSocialAccount();
  const needsReconnect = account.status === "NEEDS_RECONNECT";
  const isDisabled = account.status === "DISABLED";
  const isMetaLogin = account.authMode === "META_LOGIN";

  return (
    <li className={cn("space-y-3 rounded-lg border p-3", isSelected && "border-primary/60 bg-primary/5")}>
      <div className="flex flex-wrap items-center gap-2">
        <Instagram className="size-4 shrink-0" />
        <span className="text-sm font-medium">{account.handle ? `@${account.handle}` : account.externalAccountId}</span>
        <Badge variant={STATUS_BADGE_VARIANT[account.status]}>{STATUS_LABEL[account.status]}</Badge>
        {isSelected && <Badge variant="outline">Em uso aqui</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        {isMetaLogin
          ? "Conectada pela conexão da Meta da empresa"
          : `ID ${account.externalAccountId} · token ••••${account.accessTokenLast4}`}
        {" · "}
        {account.automationCount} automação(ões)
      </p>

      {needsReconnect && (
        <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">A Meta recusou a credencial.</p>
            <p className="text-xs text-muted-foreground">
              {account.lastErrorMessage ??
                (isMetaLogin ? "Reconecte a Meta nos Satélites." : "Gere um novo token e troque a credencial.")}
            </p>
          </div>
        </div>
      )}

      {isDisabled && (
        <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <PauseCircle className="size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">Conta desativada.</p>
            <p className="text-xs text-muted-foreground">
              As automações e o histórico foram preservados, e a URL do webhook continua a mesma. Reative para voltar a responder.
            </p>
          </div>
        </div>
      )}

      {extra}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {isDisabled && (
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
              {reactivate.isPending ? <OrbitaSpinner className="size-4" /> : <PlayCircle className="size-4" />}
              Reativar
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={repair.isPending || isDisabled}
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
            {repair.isPending ? <OrbitaSpinner className="size-4" /> : <RefreshCw className="size-4" />}
            Reenviar inscrição
          </Button>

          {!isMetaLogin && (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenGuide("keys")}>
                <KeyRound className="size-4" />
                Trocar credencial
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenGuide("webhook")}>
                <Link2 className="size-4" />
                Ver dados do webhook
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            disabled={disconnect.isPending || isDisabled}
            onClick={() =>
              disconnect.mutate(
                { channelId: account.id },
                {
                  onSuccess: () => toast.success("Conta desativada"),
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            <Unplug className="size-4" />
            Desativar
          </Button>
        </div>
      )}
    </li>
  );
}
