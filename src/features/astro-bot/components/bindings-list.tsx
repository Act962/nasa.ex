"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useBindings,
  useRevokeBinding,
} from "@/features/astro-bot/hooks/use-astro-bot";
import {
  Clock,
  Loader2,
  MessageCircle,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

function timeAgo(value: Date | string | null): string {
  if (!value) return "—";
  const ts =
    typeof value === "string" ? new Date(value).getTime() : value.getTime();
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min atrás`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

/**
 * Allow-list de números do Astro. Owner/admin: gerencia todos da org.
 */
export function BindingsList() {
  const { bindings, isLoading } = useBindings("org");
  const revoke = useRevokeBinding();

  const handleRevoke = (id: string, phone: string) => {
    if (!confirm(`Remover o número ${phone} da allow-list?`)) return;
    revoke.mutate(
      { bindingId: id },
      {
        onSuccess: () => toast.success("Número removido"),
        onError: (e) => toast.error(e.message || "Erro ao remover"),
      },
    );
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Números permitidos</h3>
        <p className="text-sm text-muted-foreground">
          Só esses números conversam com o Astro. Remova a qualquer momento.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : bindings.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum número na allow-list ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {bindings.map((binding) => (
            <div
              key={binding.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {binding.user ? (
                  <Avatar className="size-9">
                    {binding.user.image && (
                      <AvatarImage src={binding.user.image} />
                    )}
                    <AvatarFallback>
                      {binding.user.name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="size-9 rounded-full bg-violet-500/10 flex items-center justify-center">
                    <Smartphone className="size-4 text-violet-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {binding.user?.name ?? "Membro"} · +{binding.phoneE164}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {!binding.isActive && (
                      <Badge variant="outline" className="text-xs">
                        Removido
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MessageCircle className="size-3" />{" "}
                      {binding._count?.commands ?? 0} cmds
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" /> visto{" "}
                      {timeAgo(binding.lastSeenAt)}
                    </span>
                  </div>
                </div>
              </div>
              {binding.isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(binding.id, binding.phoneE164)}
                  disabled={revoke.isPending}
                >
                  <Trash2 className="size-3 mr-1" /> Remover
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
