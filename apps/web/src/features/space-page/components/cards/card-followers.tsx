"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Image from "next/image";
import { SpaceCard } from "../space-card";

interface CardFollowersProps {
  nick: string;
}

export function CardFollowers({ nick }: CardFollowersProps) {
  const { data, isLoading } = useQuery(
    orpc.public.space.listFollowers.queryOptions({
      input: { nick, limit: 20 },
    }),
  );

  const followers = data?.followers ?? [];

  return (
    <SpaceCard
      title="Seguidores"
      subtitle={`${followers.length}${data?.nextCursor ? "+" : ""} usuários acompanham esta empresa`}
      isEmpty={!isLoading && followers.length === 0}
      empty="Seja a primeira pessoa a seguir!"
    >
      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="size-10 animate-pulse rounded-full bg-white/5"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {followers.map((f) => (
            <div
              key={f.id}
              className="relative size-10 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10"
              title={f.user.name ?? ""}
            >
              {f.user.image ? (
                <Image
                  src={f.user.image}
                  alt={f.user.name ?? ""}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
                  {f.user.name?.[0] ?? "?"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SpaceCard>
  );
}
