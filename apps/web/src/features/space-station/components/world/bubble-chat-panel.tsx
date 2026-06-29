"use client";

/**
 * BubbleChatPanel — drawer lateral que abre ao clicar no botão "Chat" do
 * BubbleAppsPanel. Resolve o peer em Lead+Conversation (via resolvePeerAsLead)
 * e reusa Body/Footer do tracking-chat para conversar 1:1.
 */

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { Body } from "@/features/tracking-chat/components/body";
import { Footer } from "@/features/tracking-chat/components/footer-chat";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import type { MarkedMessage } from "@/features/tracking-chat/types";

interface Props {
  open: boolean;
  peerUserId: string | null;
  peerName: string | null;
  onClose: () => void;
}

export function BubbleChatPanel({
  open,
  peerUserId,
  peerName,
  onClose,
}: Props) {
  const [messageSelected, setMessageSelected] = useState<
    MarkedMessage | undefined
  >(undefined);
  const [resolved, setResolved] = useState<{
    leadId: string;
    conversationId: string;
    trackingId: string;
    leadName: string;
    leadPhone: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    ...orpc.spaceStation.resolvePeerAsLead.mutationOptions(),
    onSuccess: (data) => {
      setResolved(data);
      setError(null);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Erro ao abrir chat"),
  });

  useEffect(() => {
    if (!open || !peerUserId) return;
    setResolved(null);
    setError(null);
    setMessageSelected(undefined);
    mutation.mutate({ peerUserId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, peerUserId]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[420px] max-w-[95vw] bg-slate-950 border-l border-white/10 shadow-2xl flex flex-col transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-200 text-xs font-bold">
            {(peerName ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {resolved?.leadName ?? peerName ?? "Carregando..."}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {resolved?.leadPhone
                ? `+${resolved.leadPhone}`
                : "Chat via Space Station"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        {mutation.isPending && !resolved && (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {error && !resolved && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-rose-400" />
            <p className="text-sm text-rose-200">{error}</p>
            <button
              onClick={() => peerUserId && mutation.mutate({ peerUserId })}
              className="text-xs text-indigo-300 hover:text-indigo-200 underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {resolved && (
          <div className="flex-1 flex flex-col min-h-0">
            <Body
              messageSelected={messageSelected}
              onSelectMessage={setMessageSelected}
            />
            <Footer
              messageSelected={messageSelected}
              closeMessageSelected={() => setMessageSelected(undefined)}
              trackingId={resolved.trackingId}
              conversationId={resolved.conversationId}
              lead={{
                id: resolved.leadId,
                name: resolved.leadName,
                phone: resolved.leadPhone,
              }}
            />
          </div>
        )}
      </aside>
    </>
  );
}
