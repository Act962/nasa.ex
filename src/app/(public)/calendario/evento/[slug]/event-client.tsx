"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventDetailPanel } from "@/features/public-calendar/components/event-detail-panel";
import { EventCard } from "@/features/public-calendar/components/event-card";
import { usePublicEvent } from "@/features/public-calendar/hooks/use-public-event";
import type { PublicEvent } from "@/features/public-calendar/types";

export function EventClient({
  slug,
  initialData,
}: {
  slug: string;
  initialData?: Record<string, unknown>;
}) {
  const searchParams = useSearchParams();
  const sharerToken = searchParams.get("s");
  const { data, isLoading } = usePublicEvent(slug, sharerToken, initialData);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center text-sm text-muted-foreground">
        Carregando evento…
      </div>
    );
  }

  if (!data?.event) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center text-sm text-muted-foreground">
        Evento não encontrado.
      </div>
    );
  }

  const event = data.event as unknown as PublicEvent;
  const related = (data.related ?? []) as unknown as PublicEvent[];
  const viewer = (data as unknown as {
    viewer?: { canEdit?: boolean; workspaceId?: string | null };
  }).viewer;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60 px-4 py-3 lg:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href="/calendario">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Todos os eventos
            </Link>
          </Button>
        </div>
      </header>

      <main
        className={
          related.length > 0
            ? "mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[1fr_320px] lg:p-6"
            : "mx-auto max-w-3xl p-4 lg:p-6"
        }
      >
        <EventDetailPanel
          event={event}
          isLiked={!!data.isLikedByMe}
          canEdit={!!viewer?.canEdit}
          workspaceId={viewer?.workspaceId ?? null}
        />

        {related.length > 0 && (
          <aside className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Eventos relacionados
            </h2>
            <div className="flex flex-col gap-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/calendario/evento/${r.publicSlug}`}
                  className="block"
                >
                  <EventCard event={r} compact />
                </Link>
              ))}
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
