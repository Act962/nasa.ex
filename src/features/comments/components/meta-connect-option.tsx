"use client";

import { AlertTriangle, Instagram } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useCommentsMetaAccounts, useConnectCommentsWithMeta } from "../hooks/use-comments-channel";

/** Conectar o Comments com o Instagram que a empresa já ligou na Meta (spec 0061, RF-7). Some quando não há conta. */
export function MetaConnectOption({ organizationId, className }: { organizationId?: string; className?: string }) {
  const { data, isLoading } = useCommentsMetaAccounts({ organizationId });
  const connectWithMeta = useConnectCommentsWithMeta();
  const accounts = data?.accounts ?? [];

  if (isLoading || accounts.length === 0) return null;

  const connect = (metaPublishAccountId: string) =>
    connectWithMeta.mutate(
      { metaPublishAccountId, organizationId },
      {
        onSuccess: (result) =>
          result.subscribed
            ? toast.success(`Comments conectado em @${result.handle ?? "sua conta"}.`)
            : toast.warning(`Conectado, mas a Meta não confirmou o recebimento: ${result.subscriptionError ?? "tente de novo"}.`),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm text-muted-foreground">Use o Instagram que esta empresa já conectou na Meta. Não precisa de token nem de configurar nada na Meta.</p>
      <div className="flex flex-wrap gap-2">
        {accounts.map((account) => (
          <Button
            key={account.id}
            data-guide={GUIDE_ANCHORS.commentsConnectWithMeta.id}
            disabled={connectWithMeta.isPending}
            onClick={() => connect(account.id)}
            className="rounded-full"
          >
            {connectWithMeta.isPending ? (
              <OrbitaSpinner className="size-4" />
            ) : account.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.profilePictureUrl} alt="" className="size-5 rounded-full" />
            ) : (
              <Instagram className="size-4" />
            )}
            Usar @{account.username ?? account.igUserId}
          </Button>
        ))}
      </div>
      {!data?.isPlatformWebhookReady && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          A plataforma ainda não recebe comentários pela Meta (webhook não configurado). A conexão fica salva e passa a responder assim que for configurado.
        </p>
      )}
    </div>
  );
}
