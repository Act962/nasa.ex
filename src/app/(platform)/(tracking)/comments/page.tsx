"use client";

import { useState } from "react";
import { Plug, Radio, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationsList } from "@/features/comments/components/automations-list";
import { ChannelConnectCard } from "@/features/comments/components/channel-connect-card";
import { RunsPanel } from "@/features/comments/components/runs-panel";
import { useCommentsChannel } from "@/features/comments/hooks/use-comments-channel";

export default function CommentsPage() {
  const { data: channel } = useCommentsChannel();
  const isConnected = Boolean(channel?.connected);
  const needsAttention =
    channel?.connected && channel.status === "NEEDS_RECONNECT";

  // Controlada, não `defaultValue`: o status da conta chega depois do primeiro
  // render, e uma aba padrão decidida antes disso nunca mais se corrige. Assim
  // quem não tem conta cai em Integrações — e a escolha do usuário vence dali
  // em diante.
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const activeTab =
    selectedTab ??
    (channel === undefined ? "automacoes" : isConnected ? "automacoes" : "integracoes");

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">COMMENTS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Responda comentários e directs do Instagram automaticamente.
        </p>
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
            {(!isConnected || needsAttention) && (
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
          <AutomationsList canCreate={isConnected} />
        </TabsContent>

        <TabsContent value="integracoes" className="mt-4 max-w-xl">
          <ChannelConnectCard />
        </TabsContent>

        <TabsContent value="execucoes" className="mt-4">
          <RunsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
