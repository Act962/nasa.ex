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
  useNerpConnection,
  useDisconnectNerp,
} from "@/features/nerp/hooks/use-nerp-connection";
import { NerpConnectionStatus } from "./nerp-connection-status";

// Após o consent no nerp o usuário volta pra `/apps`, onde fica o card do
// NERP. Centraliza o fluxo pós-conexão em um só destino.
const RETURN_URL = "/apps?from=nerp";

export function NerpConnectCard() {
  const conn = useNerpConnection();
  const disconnect = useDisconnectNerp();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleConnect = () => {
    setIsRedirecting(true);
    window.location.href = `/api/integrations/nerp/start?returnUrl=${encodeURIComponent(RETURN_URL)}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PlugZap className="size-4" />
              nerp · ERP
            </CardTitle>
            <CardDescription>
              Conecte sua organização nerp para criar vendas, gerenciar produtos
              e consultar dashboards direto do NASA.
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
          <NerpConnectionStatus />
        ) : (
          <p className="text-sm text-muted-foreground">
            Você será redirecionado para o nerp para autorizar o acesso desta
            organização.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {conn.connected ? (
            <>
              <Button asChild size="sm">
                <Link href="/nerp">
                  Abrir nerp
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
                      onSuccess: () => toast.success("Integração nerp desativada"),
                      onError: (err: { message?: string }) =>
                        toast.error(err?.message ?? "Falha ao desconectar nerp"),
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
                Conectar com nerp
              </Button>
              <Button asChild variant="outline">
                <Link href="/nerp">
                  Ver nerp
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
