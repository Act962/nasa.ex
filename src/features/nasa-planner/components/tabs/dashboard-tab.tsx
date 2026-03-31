"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useNasaPlannerPosts, useNasaPlannerCards } from "../../hooks/use-nasa-planner";
import { CARD_STATUSES } from "../../constants";

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardTab({ plannerId }: { plannerId: string }) {
  const { posts } = useNasaPlannerPosts(plannerId);
  const { cards } = useNasaPlannerCards({ plannerId });

  const totalPosts = posts.length;
  const publishedPosts = posts.filter((p: any) => p.status === "PUBLISHED").length;
  const scheduledPosts = posts.filter((p: any) => p.status === "SCHEDULED").length;
  const draftPosts = posts.filter((p: any) => p.status === "DRAFT").length;

  const totalCards = cards.length;
  const pendingCards = cards.filter((c: any) => c.status === "TODO" || c.status === "IN_PROGRESS").length;
  const doneCards = cards.filter((c: any) => c.status === "DONE").length;

  const recentCards = [...cards]
    .sort((a: any, b: any) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Posts</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total de Posts" value={totalPosts} />
          <StatCard label="Publicados" value={publishedPosts} />
          <StatCard label="Agendados" value={scheduledPosts} />
          <StatCard label="Rascunhos" value={draftPosts} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Cards</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total de Cards" value={totalCards} />
          <StatCard label="Pendentes" value={pendingCards} />
          <StatCard label="Concluídos" value={doneCards} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Atividades Recentes
        </h2>
        {recentCards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
        ) : (
          <div className="space-y-2">
            {recentCards.map((card: any) => {
              const statusInfo = CARD_STATUSES[card.status] ?? CARD_STATUSES["TODO"];
              return (
                <div
                  key={card.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-2.5 bg-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant={statusInfo.variant} className="shrink-0 text-xs">
                      {statusInfo.label}
                    </Badge>
                    <span className="text-sm truncate">{card.title}</span>
                  </div>
                  {card.dueDate && (
                    <span className="text-xs text-muted-foreground shrink-0 ml-4">
                      {format(new Date(card.dueDate), "dd/MM/yyyy")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
