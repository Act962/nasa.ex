"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import {
  AlertTriangleIcon,
  CopyIcon,
  RadioIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useInChatStatusRealtime } from "../hooks/use-in-chat-status-realtime";

/**
 * Banner no topo do tracking-chat quando o In-Chat está ativo —
 * por AUTO (instância banida), por MANUAL (owner ligou em settings),
 * ou ambos. Avisa atendentes + dá ações rápidas: copiar a URL pública
 * ou disparar email pra todos os leads do tracking.
 *
 * Cor + copy muda conforme `source`:
 *  - `manual` → azul/violeta (informativo, ativação intencional)
 *  - `auto`   → amarelo (emergência, WhatsApp fora do ar)
 *  - `both`   → vermelho (banido + manual)
 *
 * Retorna `null` quando inativo (caso comum). Polling 30s.
 *
 * `dismissible`: usuário pode fechar pra a sessão (default false — banner
 * é importante).
 */
export function InChatActiveBanner({
  trackingId,
  dismissible = false,
}: {
  trackingId: string;
  dismissible?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);

  // Push-based — Pusher invalida quando status muda. Zero polling.
  useInChatStatusRealtime(trackingId);

  const { data } = useQuery({
    ...orpc.conversation.getInChatStatus.queryOptions({
      input: { trackingId },
    }),
    // Mesmo perfil do `InChatStatusBadge` — compartilham queryKey
    // (React Query dedupe). Safety-net interval em 15min caso Pusher
    // caia silenciosamente.
    refetchInterval: 15 * 60_000,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
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

  // Variantes por source (manual/auto/both) — cores + copy + ícone.
  const variant = (() => {
    if (data.source === "auto") {
      return {
        wrapper:
          "border-b bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200",
        button:
          "text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50",
        Icon: AlertTriangleIcon,
        title: "Modo In-Chat ativo (automático):",
        body: `WhatsApp ${data.phoneNumber ?? ""} fora do ar. Leads acessam a conversa via página pública.`,
      };
    }
    if (data.source === "both") {
      return {
        wrapper:
          "border-b bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200",
        button:
          "text-rose-900 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/50",
        Icon: AlertTriangleIcon,
        title: "WhatsApp banido + In-Chat manual ON:",
        body: `${data.phoneNumber ?? "Instância"} fora do ar e canal manual ativo. Todas as mensagens saindo pelo In-Chat.`,
      };
    }
    // manual
    return {
      wrapper:
        "border-b bg-violet-50 dark:bg-violet-950/40 text-violet-900 dark:text-violet-200",
      button:
        "text-violet-900 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/50",
      Icon: RadioIcon,
      title: "In-Chat manual ativo:",
      body: `Lead pode responder pelo WhatsApp${data.manualSetBy ? ` ou pela página pública. Ativado por ${data.manualSetBy.name}.` : " ou pela página pública."}`,
    };
  })();

  const Icon = variant.Icon;

  return (
    <div className={cn("px-4 py-2.5 flex items-center gap-3", variant.wrapper)}>
      <Icon className="size-5 shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <span className="font-semibold">{variant.title}</span>{" "}
        <span className="opacity-90">{variant.body}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className={variant.button}
        >
          <CopyIcon className="size-3.5" />
          <span className="hidden md:inline">Copiar URL</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBlast}
          disabled={blastMutation.isPending}
          className={variant.button}
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
            className={variant.button}
            aria-label="Fechar aviso"
          >
            <XIcon className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
