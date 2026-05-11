"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { SpaceCard } from "../space-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface CardProjectsProps {
  nick: string;
}

export function CardProjects({ nick }: CardProjectsProps) {
  const session = authClient.useSession();
  const isAuthenticated = !!session.data?.user?.id;

  const { data, isLoading } = useQuery(
    orpc.public.space.listProjects.queryOptions({
      input: { nick, limit: 6 },
    }),
  );

  const projects = data?.projects ?? [];

  return (
    <SpaceCard
      title="Projetos públicos"
      subtitle="Trackings compartilhados pela empresa"
      isEmpty={!isLoading && projects.length === 0}
      empty={
        isAuthenticated
          ? "Você ainda não compartilhou projetos publicamente."
          : "A empresa ainda não publicou projetos."
      }
      emptyAction={
        isAuthenticated ? (
          <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600">
            <Link href="/workspaces">
              <Plus className="mr-1 size-4" />
              Criar meu primeiro projeto
            </Link>
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-xl bg-white/5" />
          <div className="h-14 animate-pulse rounded-xl bg-white/5" />
          <div className="h-14 animate-pulse rounded-xl bg-white/5" />
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 p-3 transition hover:border-orange-500/30"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {p.name}
                </p>
                {p.description && (
                  <p className="truncate text-xs text-white/60">
                    {p.description}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="shrink-0 text-xs text-white/60">
                Público
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </SpaceCard>
  );
}
