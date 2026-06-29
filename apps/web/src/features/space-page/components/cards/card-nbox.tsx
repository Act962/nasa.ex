"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { SpaceCard } from "../space-card";
import { Button } from "@/components/ui/button";
import { FileDown, Plus } from "lucide-react";

interface CardNBoxProps {
  nick: string;
}

function formatBytes(size: number | null | undefined): string {
  if (!size) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function CardNBox({ nick }: CardNBoxProps) {
  const session = authClient.useSession();
  const isAuthenticated = !!session.data?.user?.id;

  const { data, isLoading } = useQuery(
    orpc.public.space.listPublicNBox.queryOptions({ input: { nick } }),
  );

  const items = data?.items ?? [];

  return (
    <SpaceCard
      title="Arquivos públicos"
      subtitle="Downloads liberados pela empresa"
      isEmpty={!isLoading && items.length === 0}
      empty={
        isAuthenticated
          ? "Você ainda não marcou arquivos como públicos no N-Box."
          : "Nenhum arquivo público disponível."
      }
      emptyAction={
        isAuthenticated ? (
          <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600">
            <Link href="/nbox">
              <Plus className="mr-1 size-4" />
              Enviar meu primeiro arquivo
            </Link>
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-xl bg-white/5" />
          <div className="h-12 animate-pulse rounded-xl bg-white/5" />
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3"
            >
              <FileDown className="size-5 shrink-0 text-orange-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {it.name}
                </p>
                <p className="text-xs text-white/50">
                  {it.type} · {formatBytes(it.size)}
                </p>
              </div>
              {it.publicToken && (
                <a
                  href={`/api/nbox/public/${it.publicToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-orange-300 hover:text-orange-200"
                >
                  Baixar
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </SpaceCard>
  );
}
