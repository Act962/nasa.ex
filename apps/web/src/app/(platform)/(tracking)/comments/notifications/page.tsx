"use client";

import { toast } from "sonner";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CommentsShell } from "@/features/comments/components/comments-shell";
import { CommentsConnectionGuard } from "@/features/comments/components/connection-guard";
import {
  useCommentsNotifications,
  useMarkCommentsNotificationRead,
} from "@/features/comments/hooks/use-comments-notifications";

type Notification = {
  id: string;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  type?: string | null;
  readAt?: string | Date | null;
  read?: boolean | null;
  createdAt?: string | Date | null;
};

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR");
}

function isUnread(n: Notification): boolean {
  if (typeof n.read === "boolean") return !n.read;
  return !n.readAt;
}

export default function CommentsNotificationsPage() {
  return (
    <CommentsShell
      title="Notificações"
      description="Eventos enviados pelo comments para esta organização."
    >
      <CommentsConnectionGuard>
        <NotificationsList />
      </CommentsConnectionGuard>
    </CommentsShell>
  );
}

function NotificationsList() {
  const { data, isLoading, isError, error, refetch } =
    useCommentsNotifications();
  const markAsRead = useMarkCommentsNotificationRead();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Carregando notificações…
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Falha ao carregar notificações
          </CardTitle>
          <CardDescription className="text-destructive">
            {error instanceof Error ? error.message : "Erro desconhecido"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const notifications = (Array.isArray(data) ? data : []) as Notification[];

  if (!notifications.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4" />
            Sem notificações
          </CardTitle>
          <CardDescription>
            Quando o comments enviar eventos, eles aparecem aqui.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {notifications.map((n) => {
        const unread = isUnread(n);
        return (
          <Card
            key={n.id}
            className={
              unread
                ? "border-primary/40 bg-primary/[0.03]"
                : "transition-colors hover:bg-muted/30"
            }
          >
            <CardHeader className="space-y-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {n.title ?? n.type ?? "Notificação"}
                    {unread && (
                      <Badge variant="default" className="text-[10px]">
                        Nova
                      </Badge>
                    )}
                    {n.type && (
                      <Badge variant="outline" className="text-[10px]">
                        {n.type}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {formatDate(n.createdAt)}
                  </CardDescription>
                </div>
                {unread && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      markAsRead.mutate(
                        { id: n.id },
                        {
                          onSuccess: () =>
                            toast.success("Notificação marcada como lida"),
                          onError: (err: { message?: string }) =>
                            toast.error(err?.message ?? "Falha ao marcar"),
                        },
                      )
                    }
                    disabled={markAsRead.isPending}
                  >
                    {markAsRead.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    Marcar como lida
                  </Button>
                )}
              </div>
            </CardHeader>
            {(n.message ?? n.body) && (
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
                {n.message ?? n.body}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
