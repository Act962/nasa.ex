"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MailPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeadEmailThreads } from "@/features/tracking-chat/hooks/use-tracking-chat-email";
import { LeadEmailThreadSheet } from "./lead-email-thread-sheet";

/**
 * Canal E-mail do Tracking Chat (spec 0030): conversas de e-mail entre a caixa
 * Gmail da empresa e os leads do tracking aberto.
 */

function readErrorCode(error: unknown): string | null {
  const data = (error as { data?: { code?: unknown } } | null)?.data;
  return typeof data?.code === "string" ? data.code : null;
}

function formatWhen(isoDate: string): string {
  const date = new Date(isoDate);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function LeadEmailPanel({ trackingId }: { trackingId: string | null }) {
  const { threads, isPartial, hasLeadEmails, isLoading, error, refetch } =
    useLeadEmailThreads(trackingId);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  const errorCode = readErrorCode(error);

  if (!trackingId) {
    return <PanelMessage title="Escolha um tracking" description="Os e-mails aparecem por tracking." />;
  }

  if (errorCode === "gmail_not_connected" || errorCode === "gmail_reconnect") {
    return (
      <PanelMessage
        title={errorCode === "gmail_not_connected" ? "Conecte o Gmail da empresa" : "Reconecte o Gmail"}
        description={(error as Error).message}
        action={
          <Button asChild size="sm">
            <Link href="/integrations">Ir para Integrações</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          E-mails com os leads deste tracking · últimos 90 dias
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => void refetch()}
            aria-label="Atualizar"
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setIsComposing(true)}>
            <MailPlus className="size-4" />
            Novo e-mail
          </Button>
        </div>
      </div>

      {isPartial && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Este tracking tem muitos leads com e-mail; mostrando os 50 mais recentes.
        </p>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : error ? (
        <PanelMessage
          title="Não consegui ler os e-mails"
          description={(error as Error).message || "Tente de novo em instantes."}
        />
      ) : !hasLeadEmails ? (
        <PanelMessage
          title="Nenhum lead deste tracking tem e-mail"
          description="Cadastre o e-mail no lead para as conversas aparecerem aqui."
        />
      ) : threads.length === 0 ? (
        <PanelMessage
          title="Nenhum e-mail ainda"
          description="Quando um lead deste tracking escrever para a empresa, a conversa aparece aqui."
        />
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto rounded-xl border">
          {threads.map((thread) => (
            <li key={thread.threadId}>
              <button
                type="button"
                onClick={() => setOpenThreadId(thread.threadId)}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Mail className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{thread.lead.leadName}</span>
                      {thread.isAwaitingReply && (
                        <span className="shrink-0 rounded-full bg-rose-500/15 px-1.5 py-px text-[10px] font-medium text-rose-600 dark:text-rose-400">
                          Aguardando resposta
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatWhen(thread.lastMessageAt)}
                    </span>
                  </span>
                  <span className="block truncate text-xs font-medium text-foreground/80">
                    {thread.subject}
                    {thread.messageCount > 1 && (
                      <span className="ml-1 text-muted-foreground">({thread.messageCount})</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {thread.snippet}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <LeadEmailThreadSheet
        trackingId={trackingId}
        threadId={openThreadId}
        isComposing={isComposing}
        onClose={() => {
          setOpenThreadId(null);
          setIsComposing(false);
        }}
      />
    </div>
  );
}

function PanelMessage({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center">
      <Mail className="size-7 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
