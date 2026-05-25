"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon, CopyIcon, SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Banner amarelo no topo do tracking-chat quando a instância de WhatsApp
 * do tracking está em modo In-Chat (banida/offline). Avisa atendentes +
 * dá ações rápidas: copiar a URL pública pra mandar manualmente, ou
 * disparar email pra todos os leads do tracking de uma vez.
 *
 * Retorna `null` quando o modo NÃO está ativo (caso comum) — banner só
 * aparece em emergência. Polling de 30s pra detectar quando volta a
 * funcionar ou cai.
 *
 * `dismissible`: se true, o user pode fechar o banner pra a sessão (cookie
 * de localStorage). Default false — banner é importante e queremos que
 * fique visível.
 */
export function InChatActiveBanner({
  trackingId,
  dismissible = false,
}: {
  trackingId: string;
  dismissible?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery({
    ...orpc.conversation.getInChatStatus.queryOptions({
      input: { trackingId },
    }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const blastMutation = useMutation(
    orpc.conversation.blastInChatLink.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(
          `Link disparado pra ${res.queued} ${res.queued === 1 ? "lead" : "leads"} via email.`,
        );
      },
      onError: (e: any) =>
        toast.error(e?.message ?? "Falha ao disparar links"),
    }),
  );

  if (!data?.active || dismissed) return null;

  const inChatUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/whatsapp/${data.orgSlug}`
      : `/whatsapp/${data.orgSlug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inChatUrl);
      toast.success("URL copiada");
    } catch {
      toast.error("Não consegui copiar — copie manualmente: " + inChatUrl);
    }
  };

  const handleBlast = () => {
    if (
      !confirm(
        "Vai disparar email com o link do In-Chat pra TODOS os leads ativos do tracking. Confirma?",
      )
    ) {
      return;
    }
    blastMutation.mutate({
      trackingId,
      appOrigin:
        typeof window !== "undefined" ? window.location.origin : undefined,
    });
  };

  return (
    <div
      className={cn(
        "border-b bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5",
        "flex items-center gap-3 text-amber-900 dark:text-amber-200",
      )}
    >
      <AlertTriangleIcon className="size-5 shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <span className="font-semibold">Modo In-Chat ativo:</span>{" "}
        <span className="opacity-90">
          WhatsApp {data.phoneNumber ?? ""} fora do ar. Leads acessam a
          conversa via página pública.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
        >
          <CopyIcon className="size-3.5" />
          <span className="hidden md:inline">Copiar URL</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBlast}
          disabled={blastMutation.isPending}
          className="text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
        >
          <SendIcon className="size-3.5" />
          <span className="hidden md:inline">
            {blastMutation.isPending ? "Enviando..." : "Disparar pros leads"}
          </span>
        </Button>
        {dismissible && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDismissed(true)}
            className="text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            aria-label="Fechar aviso"
          >
            <XIcon className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
