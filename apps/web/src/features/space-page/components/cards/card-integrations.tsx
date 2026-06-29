"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { SpaceCard } from "../space-card";
import { Plug } from "lucide-react";

interface CardIntegrationsProps {
  nick: string;
}

export function CardIntegrations({ nick }: CardIntegrationsProps) {
  const { data, isLoading } = useQuery(
    orpc.public.space.listActiveIntegrations.queryOptions({
      input: { nick },
    }),
  );

  const integrations = data?.integrations ?? [];

  return (
    <SpaceCard
      title="Integrações ativas"
      subtitle="Ferramentas conectadas pela empresa"
      isEmpty={!isLoading && integrations.length === 0}
      empty="Nenhuma integração ativa."
    >
      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-white/5" />
          <div className="h-10 w-28 animate-pulse rounded-xl bg-white/5" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {integrations.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white/80"
            >
              <Plug className="size-3 text-orange-400" />
              {it.platform}
            </div>
          ))}
        </div>
      )}
    </SpaceCard>
  );
}
