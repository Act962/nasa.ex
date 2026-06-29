"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BotIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { useAgents } from "../hooks/use-agents";
import { AgentCard } from "./agent-card";
import { CreateAgentDialog } from "./create-agent-dialog";

/**
 * Lista de agentes IA com botão "Criar" + grid responsivo. Filtrado por
 * trackingId quando montado dentro de um tracking — passa só os do tracking
 * + os org-wide (`trackingId=null`).
 */
export function AgentsList({ trackingId }: { trackingId?: string }) {
  const { data, isLoading } = useAgents({ trackingId });
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold uppercase tracking-wide">
            <SparklesIcon className="size-3.5" />
            NASA Auto Agent
          </div>
          <h1 className="text-2xl font-bold mt-1">Agentes IA</h1>
          <p className="text-sm text-muted-foreground max-w-2xl mt-0.5">
            Agentes autônomos que conversam com seus leads, enviam propostas,
            agendam reuniões e fecham vendas sozinhos. Configure em linguagem
            natural — a IA traduz no comportamento certo.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          Criar agente
        </Button>
      </header>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {!isLoading && (!data?.agents || data.agents.length === 0) && (
        <div className="text-center py-16 text-muted-foreground border rounded-lg">
          <BotIcon className="size-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium">Nenhum agente criado</p>
          <p className="text-xs">
            Crie o primeiro agente IA pra começar a automatizar atendimentos.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon className="size-4" />
            Criar primeiro agente
          </Button>
        </div>
      )}

      {!isLoading && data?.agents && data.agents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      <CreateAgentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        trackingId={trackingId}
      />
    </div>
  );
}
