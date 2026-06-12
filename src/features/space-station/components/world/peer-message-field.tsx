"use client";

/**
 * PeerMessageField — campo inline de mensagem direta pro peer cutucado.
 * Inspirado no `ChatFooter` de actions/workspace (Textarea + Send), versão
 * minimalista (sem emoji/anexo/áudio no MVP — esses se reusarmos o ChatFooter
 * inteiro adiciona muita superfície). Envio reusa a mutation do tracking-chat
 * (`useMutationTextMessage`) que persiste em `LeadMessage` + dispara WhatsApp
 * via Evolution.
 *
 * Pipeline de send:
 *   1. Resolve peer → Lead via `resolvePeerAsLead` (busca/cria Lead pelo phone)
 *   2. Resolve instância WhatsApp do user via `useQueryInstances(trackingId)`
 *   3. `useMutationTextMessage.mutate({ body, leadPhone, token, conversationId })`
 *
 * Pra evitar latência no primeiro Enter, resolve peer→lead no mount.
 */

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import { useMutationTextMessage } from "@/features/tracking-chat/hooks/use-messages";

interface Props {
  peerId: string;
  peerName: string;
  onSent?: () => void;
}

interface Resolved {
  leadId: string;
  conversationId: string;
  trackingId: string;
  leadName: string;
  leadPhone: string;
}

export function PeerMessageField({ peerId, peerName, onSent }: Props) {
  const { data: session } = authClient.useSession();
  const [message, setMessage] = useState("");
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1) Resolve peer → Lead eagerly no mount pra mutation já ter context pronto.
  const resolveMutation = useMutation({
    ...orpc.spaceStation.resolvePeerAsLead.mutationOptions(),
    onSuccess: (data) => {
      setResolved(data);
      setError(null);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Erro ao abrir chat"),
  });

  useEffect(() => {
    resolveMutation.mutate({ peerUserId: peerId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId]);

  // 2) Instância WhatsApp do user (pra obter token de send). Hook condicional
  //    via flag — chamado SEMPRE mas só usa quando resolved.trackingId existe.
  const instance = useQueryInstances(resolved?.trackingId ?? "");
  const apiKey = instance.instance?.apiKey;

  // 3) Mutation de send — só usa quando resolved+apiKey disponíveis.
  const sendMutation = useMutationTextMessage({
    conversationId: resolved?.conversationId ?? "",
    lead: {
      id: resolved?.leadId ?? "",
      name: resolved?.leadName ?? "",
      phone: resolved?.leadPhone ?? null,
    },
  });

  const canSend = !!resolved && !!apiKey && message.trim().length > 0 && !sendMutation.isPending;

  // Auto-focus quando o resolve termina (UX: user já pode digitar).
  useEffect(() => {
    if (resolved && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [resolved]);

  function handleSend() {
    if (!canSend || !resolved || !apiKey) return;
    const body = `*${session?.user.name ?? "Usuário"}*\n${message.trim()}`;
    sendMutation.mutate(
      {
        body,
        leadPhone: resolved.leadPhone,
        token: apiKey,
        conversationId: resolved.conversationId,
      },
      {
        onSuccess: () => {
          setMessage("");
          onSent?.();
        },
        onError: (e) => {
          setError(e instanceof Error ? e.message : "Erro ao enviar");
        },
      },
    );
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Estado: carregando resolve
  if (resolveMutation.isPending && !resolved) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-xs">
        <Loader2 className="h-4 w-4 animate-spin" />
        Conectando a {peerName}…
      </div>
    );
  }

  // Estado: erro no resolve
  if (error && !resolved) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
        <AlertTriangle className="h-5 w-5 text-rose-400" />
        <p className="text-[11px] text-rose-200">{error}</p>
        <button
          onClick={() => resolveMutation.mutate({ peerUserId: peerId })}
          className="text-[10px] text-indigo-300 hover:text-indigo-200 underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Estado: resolved mas sem instância WhatsApp configurada
  if (resolved && !instance.instanceLoading && !apiKey) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        <p className="text-[11px] text-amber-200">
          Conecte seu WhatsApp em Configurações → Integrações pra enviar
          mensagens.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 flex flex-col gap-1">
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={onKey}
        placeholder={`Mensagem para ${peerName}…`}
        rows={2}
        className="resize-none text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-indigo-500 max-h-[120px]"
      />
      {error && (
        <p className="text-[10px] text-rose-300 px-1">{error}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        <span className="text-[9px] text-slate-500 mr-auto">
          Enter envia • Shift+Enter quebra linha
        </span>
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="sm"
          className={cn(
            "h-7 px-2.5 gap-1 text-xs",
            "bg-indigo-600 hover:bg-indigo-500 text-white",
          )}
        >
          {sendMutation.isPending ? (
            <Spinner className="h-3 w-3" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          Enviar
        </Button>
      </div>
    </div>
  );
}
