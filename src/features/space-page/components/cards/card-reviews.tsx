"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { SpaceCard } from "../space-card";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitReviewDialog } from "../submit-review-dialog";

interface CardReviewsProps {
  nick: string;
}

export function CardReviews({ nick }: CardReviewsProps) {
  const [open, setOpen] = useState(false);
  const session = authClient.useSession();
  const isAuthenticated = !!session.data?.user?.id;

  const { data, isLoading } = useQuery(
    orpc.public.space.listReviews.queryOptions({
      input: { nick, limit: 6 },
    }),
  );

  const reviews = data?.reviews ?? [];
  const avg = data?.summary.averageRating ?? 0;
  const total = data?.summary.totalApproved ?? 0;

  return (
    <>
      <SpaceCard
        title="Avaliações"
        subtitle={
          total > 0
            ? `${avg.toFixed(1)}★ · ${total} ${total === 1 ? "avaliação" : "avaliações"} aprovadas`
            : "Seja o primeiro a avaliar"
        }
        action={
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => setOpen(true)}
          >
            Avaliar empresa
          </Button>
        }
        isEmpty={!isLoading && reviews.length === 0}
        empty="Ainda não há avaliações aprovadas."
        emptyAction={
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => setOpen(true)}
          >
            Avaliar empresa
          </Button>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-20 animate-pulse rounded-xl bg-white/5" />
            <div className="h-20 animate-pulse rounded-xl bg-white/5" />
          </div>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-white/5 bg-white/5 p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-yellow-400">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="size-3 fill-current" />
                    ))}
                  </div>
                  <span className="text-xs text-white/50">
                    {r.author?.name ?? r.authorName ?? "Anônimo"}
                    {r.verified && (
                      <span className="ml-1 rounded bg-green-500/20 px-1 text-[10px] text-green-300">
                        verificado
                      </span>
                    )}
                  </span>
                </div>
                {r.title && (
                  <p className="text-sm font-medium text-white">{r.title}</p>
                )}
                {r.comment && (
                  <p className="text-xs text-white/70">{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SpaceCard>

      {/* Dialog precisa viver FORA do SpaceCard — quando isEmpty=true,
          os children do SpaceCard não são renderizados, e o dialog
          ficaria desmontado, fazendo o botão "Avaliar empresa" nunca abrir. */}
      <SubmitReviewDialog
        nick={nick}
        open={open}
        onOpenChange={setOpen}
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}
