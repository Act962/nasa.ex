"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Link2, MessageCircle, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useSendReceiptLinkMessage } from "../../hooks/use-messages";
import { receiptMessage } from "./receipt-draft";

export interface IssuedReceipt {
  number: number;
  url: string;
  clientName: string;
  /** Conversa de WhatsApp aberta nas últimas 24h (recibo avulso); `null` = só copiar o link (spec 0151, RF-12). */
  openWhatsapp: { conversationId: string; phone: string } | null;
  isSent: boolean;
  hasSendFailed: boolean;
}

export function IssuedReceiptView({ issued, onClose }: { issued: IssuedReceipt; onClose: () => void }) {
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [isSent, setIsSent] = useState(issued.isSent);
  const sendMessage = useSendReceiptLinkMessage();
  const copyLink = async () => {
    await navigator.clipboard.writeText(issued.url);
    setIsLinkCopied(true);
    setTimeout(() => setIsLinkCopied(false), 2000);
  };
  const sendOnWhatsapp = () => {
    if (!issued.openWhatsapp || sendMessage.isPending || isSent) return;
    sendMessage.mutate(
      {
        body: receiptMessage(issued.clientName, issued.url),
        leadPhone: issued.openWhatsapp.phone,
        conversationId: issued.openWhatsapp.conversationId,
      },
      {
        onSuccess: () => setIsSent(true),
        onError: (error) => toast.error(error.message || "Não foi possível enviar. Copie o link."),
      },
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 text-center">
      {issued.hasSendFailed ? <AlertTriangle className="size-12 text-warning" /> : <CheckCircle2 className="size-12 text-success" />}
      <p className="text-lg font-semibold">Recibo nº {String(issued.number).padStart(4, "0")} emitido</p>
      <p className="text-sm text-muted-foreground">
        {isSent
          ? "O link do recibo foi enviado no WhatsApp do cliente."
          : issued.hasSendFailed
            ? "A venda ficou registrada, mas a mensagem não foi enviada. Copie o link e mande ao cliente."
            : "A venda ficou registrada e entrou no Financeiro como paga."}
      </p>
      <div className="flex w-full items-center gap-2 rounded-lg border bg-muted/40 p-2">
        <span className="min-w-0 flex-1 truncate text-left text-xs">{issued.url}</span>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={copyLink}>
          {isLinkCopied ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {isLinkCopied ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      <div className="flex w-full flex-col gap-2">
        {issued.openWhatsapp && !isSent ? (
          <Button type="button" className="h-11 gap-2" disabled={sendMessage.isPending} onClick={sendOnWhatsapp}>
            {sendMessage.isPending ? <OrbitaSpinner className="size-4" /> : <MessageCircle className="size-4" />}
            Enviar por WhatsApp
          </Button>
        ) : null}
        <Button asChild variant="outline" className="h-11 gap-2">
          <a href={issued.url} target="_blank" rel="noopener noreferrer">
            <Receipt className="size-4" /> Ver recibo
          </a>
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
