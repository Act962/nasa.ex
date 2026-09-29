"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useLeadEmailThread,
  useSendLeadEmail,
  useTrackingLeadsWithEmail,
} from "@/features/tracking-chat/hooks/use-tracking-chat-email";

/**
 * Ler uma conversa de e-mail e responder, ou escrever um e-mail novo para um
 * lead do tracking (spec 0030, RF-3 a RF-5). O envio sai pelo Gmail da empresa.
 */

function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`;
}

export function LeadEmailThreadSheet({
  trackingId,
  threadId,
  isComposing,
  onClose,
}: {
  trackingId: string;
  threadId: string | null;
  isComposing: boolean;
  onClose: () => void;
}) {
  const isOpen = Boolean(threadId) || isComposing;
  const { thread, isLoading } = useLeadEmailThread(trackingId, threadId);
  const { leads } = useTrackingLeadsWithEmail(trackingId, isComposing);
  const sendEmail = useSendLeadEmail();

  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Cada conversa aberta começa com o assunto dela e o destinatário certo. Só
  // reage à troca de conversa: um refetch ao focar a aba apagaria o rascunho.
  const loadedThreadId = thread?.threadId ?? null;
  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setBody("");
    if (thread) {
      setSubject(replySubject(thread.subject));
      setRecipient(thread.lead.email);
    } else if (isComposing) {
      setSubject("");
      setRecipient("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isComposing, loadedThreadId]);

  function handleSend() {
    if (!recipient) {
      toast.error("Escolha o lead que vai receber o e-mail.");
      return;
    }
    sendEmail.mutate(
      {
        trackingId,
        to: recipient,
        subject: subject.trim(),
        title: title.trim() || undefined,
        body: body.trim(),
        threadId: threadId ?? undefined,
      },
      {
        onSuccess: (result) => {
          toast.success(`E-mail enviado para ${result.lead.leadName}`);
          setTitle("");
          setBody("");
          if (isComposing) onClose();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  const canSend =
    Boolean(recipient) && subject.trim().length > 0 && body.trim().length > 0 && !sendEmail.isPending;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="truncate">
            {isComposing ? "Novo e-mail" : (thread?.subject ?? "Conversa de e-mail")}
          </SheetTitle>
          <SheetDescription>
            {isComposing
              ? "Enviado pelo Gmail da empresa para um lead deste tracking."
              : thread
                ? `${thread.lead.leadName} · ${thread.lead.email}`
                : "Carregando…"}
          </SheetDescription>
        </SheetHeader>

        {!isComposing && (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))
            ) : (
              thread?.messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "rounded-xl border p-3",
                    message.isFromLead ? "bg-muted/40" : "border-primary/20 bg-primary/5",
                  )}
                >
                  <header className="mb-2 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium">
                      {message.isFromLead
                        ? (message.from.name ?? message.from.email)
                        : `Empresa · ${message.from.email}`}
                    </span>
                    <time className="shrink-0 text-muted-foreground">
                      {new Date(message.sentAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </header>
                  {/* Texto puro: e-mail em HTML é convertido no servidor (RNF-2). */}
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {message.bodyText || "(sem conteúdo em texto)"}
                  </p>
                </article>
              ))
            )}
          </div>
        )}

        <div className={cn("space-y-3 border-t p-4", isComposing && "flex-1 overflow-y-auto border-t-0")}>
          {isComposing && (
            <div className="space-y-1.5">
              <Label>Para</Label>
              <Select value={recipient} onValueChange={setRecipient}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um lead com e-mail" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.email} value={lead.email}>
                      {lead.leadName} · {lead.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="lead-email-subject">Assunto</Label>
            <Input
              id="lead-email-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Assunto do e-mail"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-email-title">Título (opcional)</Label>
            <Input
              id="lead-email-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Aparece em destaque no topo da mensagem"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-email-body">Mensagem</Label>
            <Textarea
              id="lead-email-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={isComposing ? 12 : 6}
              placeholder="Escreva sua resposta…"
            />
          </div>

          <Button className="w-full gap-2" onClick={handleSend} disabled={!canSend}>
            {sendEmail.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {isComposing ? "Enviar e-mail" : "Responder"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
