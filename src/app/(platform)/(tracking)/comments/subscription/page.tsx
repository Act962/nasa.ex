"use client";

import { toast } from "sonner";
import { CreditCard, ExternalLink, Loader2, Sparkles } from "lucide-react";
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
import {
  useCommentsBillingPortal,
  useCommentsCurrentSubscription,
  useUpgradeCommentsSubscription,
} from "@/features/comments/hooks/use-comments-subscription";

type Subscription = {
  plan?: string | null;
  status?: string | null;
  renewsAt?: string | Date | null;
  cancelAt?: string | Date | null;
  trialEndsAt?: string | Date | null;
};

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return (typeof d === "string" ? new Date(d) : d).toLocaleString("pt-BR");
}

export default function CommentsSubscriptionPage() {
  return (
    <CommentsShell
      title="Plano"
      description="Gerencie a assinatura do comments para esta organização."
    >
      <CommentsConnectionGuard>
        <SubscriptionCard />
      </CommentsConnectionGuard>
    </CommentsShell>
  );
}

function SubscriptionCard() {
  const { data, isLoading, isError, error, refetch } =
    useCommentsCurrentSubscription();
  const upgrade = useUpgradeCommentsSubscription();
  const portal = useCommentsBillingPortal();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Carregando assinatura…
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

  const sub = (data ?? {}) as Subscription;
  const plan = (sub.plan ?? "free").toString();
  const status = (sub.status ?? "—").toString();
  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/comments/subscription`
      : "/comments/subscription";

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4" />
              Plano atual
            </CardTitle>
            <CardDescription>
              Detalhes da assinatura comments desta organização.
            </CardDescription>
          </div>
          <Badge variant={plan === "pro" ? "default" : "secondary"}>
            {plan.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-muted-foreground">
              Status
            </div>
            <div>{status}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">
              Renova em
            </div>
            <div>{formatDate(sub.renewsAt)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">
              Cancela em
            </div>
            <div>{formatDate(sub.cancelAt)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">
              Fim do trial
            </div>
            <div>{formatDate(sub.trialEndsAt)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {plan !== "pro" && (
            <Button
              onClick={() =>
                upgrade.mutate(
                  { plan: "pro", callbackUrl },
                  {
                    onSuccess: (data: unknown) => {
                      const url = (data as { url?: string } | undefined)?.url;
                      if (url) window.location.href = url;
                      else
                        toast.success(
                          "Upgrade iniciado — verifique seu e-mail",
                        );
                    },
                    onError: (err: { message?: string }) =>
                      toast.error(err?.message ?? "Falha no upgrade"),
                  },
                )
              }
              disabled={upgrade.isPending}
            >
              {upgrade.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Fazer upgrade para PRO
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() =>
              portal.mutate(
                { callbackUrl },
                {
                  onSuccess: (data: unknown) => {
                    const url = (data as { url?: string } | undefined)?.url;
                    if (url) window.location.href = url;
                  },
                  onError: (err: { message?: string }) =>
                    toast.error(err?.message ?? "Falha ao abrir portal"),
                },
              )
            }
            disabled={portal.isPending}
          >
            {portal.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ExternalLink className="size-3.5" />
            )}
            Abrir portal de cobrança
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
