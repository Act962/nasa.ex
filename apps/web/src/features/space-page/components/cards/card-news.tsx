"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { SpaceCard } from "../space-card";

interface CardNewsProps {
  nick: string;
}

export function CardNews({ nick }: CardNewsProps) {
  const { data, isLoading } = useQuery(
    orpc.public.space.listPosts.queryOptions({
      input: { nick, limit: 4 },
    }),
  );

  const posts = data?.posts ?? [];

  return (
    <SpaceCard
      title="News da empresa"
      subtitle="Novidades publicadas pelo time"
      isEmpty={!isLoading && posts.length === 0}
      empty="Nenhum post publicado ainda."
    >
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-32 animate-pulse rounded-xl bg-white/5" />
          <div className="h-32 animate-pulse rounded-xl bg-white/5" />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/space/${nick}/post/${p.slug}`}
                className="block overflow-hidden rounded-xl border border-white/5 bg-white/5 transition hover:border-orange-500/30"
              >
                {p.coverUrl && (
                  <div className="relative aspect-video w-full">
                    <Image
                      src={p.coverUrl}
                      alt={p.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium text-white">
                    {p.title}
                  </p>
                  {p.excerpt && (
                    <p className="line-clamp-2 text-xs text-white/60">
                      {p.excerpt}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-white/50">
                    {p.author?.name ?? ""} ·{" "}
                    {p.publishedAt
                      ? new Date(p.publishedAt).toLocaleDateString("pt-BR")
                      : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SpaceCard>
  );
}
