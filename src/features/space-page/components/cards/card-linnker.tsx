"use client";

import NextLink from "next/link";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { SpaceCard } from "../space-card";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon, Plus } from "lucide-react";

interface CardLinnkerProps {
  nick: string;
}

export function CardLinnker({ nick }: CardLinnkerProps) {
  const session = authClient.useSession();
  const isAuthenticated = !!session.data?.user?.id;

  const { data, isLoading } = useQuery(
    orpc.public.space.listLinnker.queryOptions({ input: { nick } }),
  );

  const pages = data?.pages ?? [];
  const allLinks = pages.flatMap((p) => p.links);

  return (
    <SpaceCard
      title="Linnker"
      subtitle="Links importantes da empresa"
      isEmpty={!isLoading && allLinks.length === 0}
      empty={
        isAuthenticated
          ? "Você ainda não publicou um Linnker."
          : "Nenhum Linnker publicado."
      }
      emptyAction={
        isAuthenticated ? (
          <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600">
            <NextLink href="/linnker">
              <Plus className="mr-1 size-4" />
              Criar meu primeiro Linnker
            </NextLink>
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded-xl bg-white/5" />
          <div className="h-10 animate-pulse rounded-xl bg-white/5" />
        </div>
      ) : (
        <ul className="space-y-2">
          {allLinks.map((l) => (
            <li key={l.id}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3 transition hover:border-orange-500/30"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-orange-300">
                  {l.emoji ? (
                    <span className="text-base">{l.emoji}</span>
                  ) : (
                    <LinkIcon className="size-4" />
                  )}
                </div>
                <span className="truncate text-sm text-white">{l.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </SpaceCard>
  );
}
