"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useSocialAccounts, type SocialAccount } from "../hooks/use-social-accounts";
import { InstagramConnectGuideDialog, type GuideTargetAccount } from "./instagram-connect-guide-dialog";
import { MetaConnectOption } from "./meta-connect-option";
import { SocialAccountCard } from "./social-account-card";

export type AccountGuideState = { isOpen: false } | { isOpen: true; targetAccount?: GuideTargetAccount };

export function LegacyDirectMessageNotice() {
  return (
    <p className="flex items-start gap-2 rounded-[14px] bg-panel p-3 text-xs text-muted-foreground">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      Esta empresa tem uma conexão antiga de Instagram DM. Ela continua recebendo mensagens, mas não serve ao
      Comments nem ao Planner. Adicione a conta pelo passo a passo para usar em todos os apps.
    </p>
  );
}

/**
 * Contas do Instagram da organização dentro de outra tela (spec 0069) — hoje, a aba Integrações
 * do Comments. A página completa é `instagram-accounts-page.tsx`.
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
  const [guide, setGuide] = useState<AccountGuideState>({ isOpen: false });

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
    <div className={cn("space-y-3", className)}>
      {accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma conta do Instagram conectada. Conecte uma para responder comentários e directs e, depois, publicar pelo Planner.
        </p>
      )}

      {accounts.map((account) => (
        <SocialAccountCard
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

      {hasLegacyDirectMessageIntegration && <LegacyDirectMessageNotice />}

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
