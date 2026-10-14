"use client";

import { useState } from "react";
import { HandCoinsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { SendQuoteForm, type QuoteFormItem } from "./send-quote-form";

interface SendQuoteDialogProps {
  orderId: string;
  saleNumber: number;
  items: QuoteFormItem[];
  shipping: number;
  discount: number;
}

export function SendQuoteDialog({ orderId, saleNumber, items, shipping, discount }: SendQuoteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" data-guide={GUIDE_ANCHORS.catalogOrderSendQuote.id}>
          <HandCoinsIcon className="size-3.5" />
          Enviar valor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Valor do pedido #{saleNumber}</DialogTitle>
          <DialogDescription>
            Os preços já vêm da tabela do NERP; ajuste o que foi negociado. O cliente recebe o valor no WhatsApp e
            aprova. Só depois o Astro gera o PIX ou o link de pagamento.
          </DialogDescription>
        </DialogHeader>
        <SendQuoteForm
          orderId={orderId}
          items={items}
          shipping={shipping}
          discount={discount}
          onSent={() => setIsOpen(false)}
          onCancel={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
