"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Loader2, Plug, PlugZap, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useCommentsConnection,
  useDisconnectComments,
} from "@/features/comments/hooks/use-comments-connection";
import { CommentsConnectionStatus } from "./comments-connection-status";

const RETURN_URL = "/apps?from=comments";

export function CommentsConnectCard() {
  const conn = useCommentsConnection();
  const disconnect = useDisconnectComments();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleConnect = () => {
    setIsRedirecting(true);
    window.location.href = `/api/integrations/comments-app/start?returnUrl=${encodeURIComponent(RETURN_URL)}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PlugZap className="size-4" />
              comments · Engajamento
            </CardTitle>
            <CardDescription>
              Conecte sua organização ao comments para responder comentários,
              rodar sorteios e automações no Instagram/Facebook.
            </CardDescription>
          </div>
          {conn.connected ? (
            <Badge variant={conn.isActive ? "default" : "secondary"}>
              {conn.isActive ? "Conectado" : "Desativado"}
            </Badge>
          ) : (
            <Badge variant="outline">Desconectado</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {conn.connected ? (
          <CommentsConnectionStatus />
        ) : (
          <p className="text-sm text-muted-foreground">
            Você será redirecionado ao comments para autorizar o acesso desta
            organização.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {conn.connected ? (
            <>
              <Button asChild size="sm">
                <Link href="/comments">
                  Abrir comments
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
                disabled={isRedirecting}
              >
                {isRedirecting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plug className="size-3.5" />
                )}
                Reconectar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  disconnect.mutate(
                    { hard: false },
                    {
                      onSuccess: () =>
                        toast.success("Integração comments desativada"),
                      onError: (err: { message?: string }) =>
                        toast.error(
                          err?.message ?? "Falha ao desconectar comments",
                        ),
                    },
                  )
                }
                disabled={disconnect.isPending}
              >
                {disconnect.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Power className="size-3.5" />
                )}
                Desconectar
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleConnect} disabled={isRedirecting}>
                {isRedirecting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plug className="size-3.5" />
                )}
                Conectar com comments
              </Button>
              <Button asChild variant="outline">
                <Link href="/comments">
                  Ver comments
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
