"use client";

import { toast } from "sonner";
import { MessagesSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/features/astro-commander/lib/labels";
import { useAstroSessions, useDeleteAstroSession } from "@/features/astro-commander/hooks/use-astro-sessions";

/**
 * Conversas com o ASTRO (spec 0028, RF-10). Consome as procedures de sessão
 * que já existem — aqui elas só ganham uma tela própria.
 */
export function SessionsTab() {
  const { sessions, isLoading } = useAstroSessions();
  const deleteSession = useDeleteAstroSession();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <MessagesSquare className="size-8 text-muted-foreground" />
        <p className="font-medium">Nenhuma conversa ainda</p>
        <p className="text-sm text-muted-foreground">
          As conversas com o ASTRO ficam guardadas aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex items-center justify-between gap-3 p-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">
              {session.title || "Conversa com ASTRO"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(session.updatedAt)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              deleteSession.mutate(
                { id: session.id },
                {
                  onSuccess: () => toast.success("Conversa excluída"),
                  onError: (error) => toast.error(error.message),
                },
              )
            }
            disabled={deleteSession.isPending}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
