"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Image from "next/image";
import { SpaceCard } from "../space-card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface CardRankingProps {
  nick: string;
}

export function CardRanking({ nick }: CardRankingProps) {
  const { data, isLoading } = useQuery(
    orpc.public.space.listRanking.queryOptions({
      input: { nick, limit: 5 },
    }),
  );

  const rows = data ?? [];

  return (
    <SpaceCard
      title="Top membros"
      subtitle="Ranking por Space Points"
      isEmpty={!isLoading && rows.length === 0}
      empty="Nenhum membro no ranking ainda."
    >
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-xl bg-muted/50" />
          <div className="h-12 animate-pulse rounded-xl bg-muted/50" />
          <div className="h-12 animate-pulse rounded-xl bg-muted/50" />
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.user.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-2"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-xs font-bold text-warning">
                {r.position === 1 ? (
                  <Trophy className="size-4" />
                ) : (
                  r.position
                )}
              </div>
              <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-muted">
                {r.user.image ? (
                  <Image
                    src={r.user.image}
                    alt={r.user.name ?? ""}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    {r.user.name?.[0] ?? "?"}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{r.user.name}</p>
              </div>
              <Badge
                variant="outline"
                className="shrink-0 text-xs text-info"
              >
                {r.totalPoints} pts
              </Badge>
            </li>
          ))}
        </ol>
      )}
    </SpaceCard>
  );
}
