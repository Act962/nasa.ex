"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plug, Radio, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationsList } from "@/features/comments/components/automations-list";
import { CommentsAccountSelect, accountLabelOf } from "@/features/comments/components/comments-account-select";
import { LeadTrackingSelect } from "@/features/comments/components/lead-tracking-select";
import { RunsPanel } from "@/features/comments/components/runs-panel";
import { useSelectedCommentsAccount } from "@/features/comments/hooks/use-comments-channel";
import { SocialAccountsManager } from "@/features/social-accounts/components/social-accounts-manager";

const COMMENTS_TABS = ["automacoes", "integracoes", "execucoes"] as const;

export default function CommentsPage() {
  // `useSearchParams` exige Suspense para a página não quebrar no prerender.
  return (
    <Suspense>
      <CommentsPageContent />
    </Suspense>
  );
}

function CommentsPageContent() {
  const { accounts, selectedAccount, selectAccount, canManage, isLoading } = useSelectedCommentsAccount();
  // `?tab=integracoes` vem de outros apps (ex.: o Instagram apagado no chat,
  // spec 0029 RF-13) e abre direto na aba certa.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const linkedTab = COMMENTS_TABS.find((tab) => tab === requestedTab) ?? null;
  const hasAccount = accounts.length > 0;
  const needsAttention = selectedAccount?.status === "NEEDS_RECONNECT";

  // Controlada, não `defaultValue`: as contas chegam depois do primeiro
  // render, e uma aba padrão decidida antes disso nunca mais se corrige. Assim
  // quem não tem conta cai em Integrações — e a escolha do usuário vence dali
  // em diante.
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const activeTab =
    selectedTab ?? linkedTab ?? (isLoading || hasAccount ? "automacoes" : "integracoes");

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-2">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">COMMENTS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Responda comentários e directs do Instagram automaticamente.
          </p>
        </div>
        <CommentsAccountSelect
          accounts={accounts}
          selectedAccountId={selectedAccount?.id ?? null}
          onSelect={selectAccount}
        />
      </header>

      <Tabs value={activeTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="automacoes" className="gap-1.5">
            <Zap className="size-3.5" />
            Automações
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="gap-1.5">
            <Plug className="size-3.5" />
            Integrações
            {/* Sem conta conectada nada funciona — a aba avisa sem precisar
                abrir. */}
            {!isLoading && (!hasAccount || needsAttention) && (
              <Badge
                variant={needsAttention ? "destructive" : "secondary"}
                className="px-1.5 py-0 text-[10px]"
              >
                {needsAttention ? "!" : "conectar"}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="execucoes" className="gap-1.5">
            <Radio className="size-3.5" />
            Execuções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automacoes" className="mt-4">
          <AutomationsList
            channelId={selectedAccount?.id ?? null}
            accountLabel={selectedAccount ? accountLabelOf(selectedAccount) : undefined}
          />
        </TabsContent>

        <TabsContent value="integracoes" className="mt-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contas do Instagram</CardTitle>
              <CardDescription>
                As mesmas contas dos{" "}
                <Link href="/integrations?connect=INSTAGRAM" className="underline">
                  Satélites
                </Link>
                . A conta marcada como &ldquo;em uso aqui&rdquo; é a que você escolheu no topo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SocialAccountsManager
                selectedAccountId={selectedAccount?.id ?? null}
                onAccountConnected={selectAccount}
                // Só contas conectadas pela Meta viram lead no chat (spec 0062).
                renderAccountExtra={(account) =>
                  account.authMode === "META_LOGIN" ? (
                    <LeadTrackingSelect channelId={account.id} isDisabled={!canManage} />
                  ) : null
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execucoes" className="mt-4">
          <RunsPanel channelId={selectedAccount?.id ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
