"use client";

import { useState, type FormEvent } from "react";
import { QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePayCatalogOrderWithPix } from "../../hooks/use-catalog-order-portal";

function formatDocument(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

// Cliente gera o próprio PIX pelo portal; o QR aparece no OrderPaymentCard assim que o pedido vira AWAITING_PAYMENT.
export function OrderPixStartCard({ token }: { token: string }) {
  const [document, setDocument] = useState("");
  const payWithPix = usePayCatalogOrderWithPix(token);
  const digitCount = document.replace(/\D/g, "").length;
  const isDocumentComplete = digitCount === 11 || digitCount === 14;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    payWithPix.mutate(
      { token, document },
      { onError: (error) => toast.error(error.message || "Não foi possível gerar o PIX.") },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <p className="text-sm font-semibold">Pagar com PIX</p>
      <p className="text-xs text-muted-foreground">Informe o CPF ou CNPJ de quem vai pagar para gerar o QR Code.</p>
      <Input
        inputMode="numeric"
        autoComplete="off"
        placeholder="CPF ou CNPJ"
        value={document}
        onChange={(event) => setDocument(formatDocument(event.target.value))}
      />
      <Button type="submit" className="w-full" disabled={!isDocumentComplete || payWithPix.isPending}>
        <QrCode className="size-4" /> {payWithPix.isPending ? "Gerando PIX…" : "Gerar PIX"}
      </Button>
    </form>
  );
}
