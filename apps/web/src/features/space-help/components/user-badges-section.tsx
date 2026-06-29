"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Award, GraduationCap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function UserBadgesSection({ userId }: { userId?: string }) {
  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.listUserBadges.queryOptions({
      input: { userId },
    }),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <header className="flex items-center gap-2 mb-4">
        <GraduationCap className="size-5 text-violet-600" />
        <h2 className="text-lg font-bold tracking-tight">Selos de Aprendizado</h2>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : !data?.badges.length ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <Award className="size-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum selo conquistado ainda.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Conclua rotas de conhecimento em{" "}
            <span className="text-violet-600">Space Help</span> para ganhar selos
            exclusivos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.badges.map((b) => (
            <div
              key={b.id}
              className="group relative flex flex-col items-center rounded-xl border border-border bg-gradient-to-br from-violet-500/5 to-transparent p-4 text-center hover:border-violet-500/50 transition"
              title={b.badge.description ?? undefined}
            >
              <div
                className="flex size-14 items-center justify-center rounded-full ring-2 ring-white/20 shadow-md mb-2"
                style={{ backgroundColor: b.badge.color ?? "#7C3AED" }}
              >
                {b.badge.iconUrl ? (
                  <img src={b.badge.iconUrl} alt={b.badge.name} className="size-9" />
                ) : (
                  <Award className="size-7 text-white" />
                )}
              </div>
              <p className="text-sm font-bold leading-tight">{b.badge.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {dateFmt.format(new Date(b.earnedAt))}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
