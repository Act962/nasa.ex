"use client";

import { Loader2, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CommentsShell } from "@/features/comments/components/comments-shell";
import { CommentsConnectionGuard } from "@/features/comments/components/connection-guard";
import { useCommentsIntegrations } from "@/features/comments/hooks/use-comments-integrations";

type Integration = {
  id: string;
  name?: string | null;
  platform?: string | null;
  type?: string | null;
  token?: string | null;
  expire?: string | Date | null;
  expiresAt?: string | Date | null;
  createdAt?: string | Date | null;
  active?: boolean | null;
};

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return (typeof d === "string" ? new Date(d) : d).toLocaleString("pt-BR");
}

export default function CommentsIntegrationsPage() {
  return (
    <CommentsShell
      title="Integrações"
      description="Contas do Instagram/Facebook conectadas ao seu workspace comments."
    >
      <CommentsConnectionGuard>
        <IntegrationsList />
      </CommentsConnectionGuard>
    </CommentsShell>
  );
}

function IntegrationsList() {
  const { data, isLoading, isError, error, refetch } =
    useCommentsIntegrations();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Carregando integrações…
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Erro ao carregar</CardTitle>
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

  const items = (Array.isArray(data) ? data : []) as Integration[];

  if (!items.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="size-4" />
            Nenhuma integração
          </CardTitle>
          <CardDescription>
            Vincule uma conta Meta dentro do comments para começar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => (
        <Card key={i.id}>
          <CardHeader className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plug className="size-4" />
                {i.name ?? "Integração"}
              </CardTitle>
              {i.active === false ? (
                <Badge variant="secondary">Desativada</Badge>
              ) : (
                <Badge variant="default">Ativa</Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              {i.platform ?? i.type ?? "Meta"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <div>
              <span className="uppercase">Conectada em:</span>{" "}
              {formatDate(i.createdAt)}
            </div>
            <div>
              <span className="uppercase">Expira em:</span>{" "}
              {formatDate(i.expire ?? i.expiresAt)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
