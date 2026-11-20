"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Link2, MessageCircle, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeWhatsappPhoneBr } from "@/utils/format-phone";
import { receiptMessage } from "./receipt-draft";

export interface IssuedReceipt {
  number: number;
  url: string;
  clientName: string;
  /** Telefone para o botão do WhatsApp no recibo avulso; `null` no chat, onde o link vai na conversa. */
  whatsappPhone: string | null;
  isSent: boolean;
  hasSendFailed: boolean;
}

export function IssuedReceiptView({ issued, onClose }: { issued: IssuedReceipt; onClose: () => void }) {
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const copyLink = async () => {
    await navigator.clipboard.writeText(issued.url);
    setIsLinkCopied(true);
    setTimeout(() => setIsLinkCopied(false), 2000);
  };
  const whatsappDigits = issued.whatsappPhone ? normalizeWhatsappPhoneBr(issued.whatsappPhone) : null;
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(receiptMessage(issued.clientName, issued.url))}`
    : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 text-center">
      {issued.hasSendFailed ? <AlertTriangle className="size-12 text-warning" /> : <CheckCircle2 className="size-12 text-success" />}
      <p className="text-lg font-semibold">Recibo nº {String(issued.number).padStart(4, "0")} emitido</p>
      <p className="text-sm text-muted-foreground">
        {issued.isSent
          ? "O link do recibo foi enviado na conversa."
          : issued.hasSendFailed
            ? "A venda ficou registrada, mas a mensagem não foi enviada. Copie o link e mande ao cliente."
            : "A venda ficou registrada. Mande o link ao cliente."}
      </p>
      <div className="flex w-full items-center gap-2 rounded-lg border bg-muted/40 p-2">
        <span className="min-w-0 flex-1 truncate text-left text-xs">{issued.url}</span>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={copyLink}>
          {isLinkCopied ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {isLinkCopied ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      <div className="flex w-full flex-col gap-2">
        {whatsappHref ? (
          <Button asChild className="h-11 gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5a]">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" /> Enviar no WhatsApp
            </a>
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
