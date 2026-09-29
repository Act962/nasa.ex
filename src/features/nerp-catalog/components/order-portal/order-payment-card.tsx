"use client";

import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type OrderPayment = {
  method: "PIX" | "ASAAS_LINK" | null;
  pixPayload: string | null;
  pixQrImage: string | null;
  invoiceUrl: string | null;
};

export function OrderPaymentCard({ payment }: { payment: OrderPayment }) {
  const copyPix = async () => {
    if (!payment.pixPayload) return;
    await navigator.clipboard.writeText(payment.pixPayload);
    toast.success("Código PIX copiado");
  };

  if (payment.method === "PIX" && payment.pixPayload) {
    return (
      <div className="flex flex-col items-center gap-3">
        {payment.pixQrImage && (
          // eslint-disable-next-line @next/next/no-img-element -- QR vem em base64 do Asaas
          <img
            src={`data:image/png;base64,${payment.pixQrImage}`}
            alt="QR Code PIX"
            className="size-48 rounded-lg border bg-white p-2"
          />
        )}
        <p className="w-full break-all rounded-md bg-muted p-2 font-mono text-xs">{payment.pixPayload}</p>
        <Button onClick={copyPix} className="w-full">
          <Copy className="size-4" /> Copiar código PIX
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Assim que o pagamento cair, seu pedido segue automaticamente para separação.
        </p>
      </div>
    );
  }

  if (payment.invoiceUrl) {
    return (
      <Button asChild className="w-full">
        <a href={payment.invoiceUrl} target="_blank" rel="noopener noreferrer">
          Pagar com cartão ou boleto <ExternalLink className="size-4" />
        </a>
      </Button>
    );
  }

  return null;
}
