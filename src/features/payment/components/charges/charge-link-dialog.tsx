"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { PixSettingsDialog } from "@/features/form-records/components/record-pix-actions";
import { formatCurrency } from "../../lib/format";
import { usePaymentChargeLink } from "../../hooks/use-payment-charges";

interface Props {
  entryId: string | null;
  entryName?: string;
  onClose: () => void;
}

export function ChargeLinkDialog({ entryId, entryName, onClose }: Props) {
  const chargeLink = usePaymentChargeLink();
  const [isPixSettingsOpen, setIsPixSettingsOpen] = useState(false);
  const { mutate: requestChargeLink, reset: resetChargeLink } = chargeLink;

  useEffect(() => {
    if (!entryId) {
      resetChargeLink();
      return;
    }
    requestChargeLink({ entryId });
  }, [entryId, requestChargeLink, resetChargeLink]);

  function handlePixSettingsChange(isOpen: boolean) {
    setIsPixSettingsOpen(isOpen);
    if (!isOpen && entryId) requestChargeLink({ entryId });
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link de pagamento copiado");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie à mão.");
    }
  }

  const linkData = chargeLink.data;

  return (
    <>
      <Dialog open={!!entryId} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link de pagamento</DialogTitle>
            <DialogDescription>
              {entryName ? `"${entryName}". ` : ""}
              O cliente abre a página, vê o valor e paga pelo PIX. A régua de cobrança envia este mesmo link.
            </DialogDescription>
          </DialogHeader>

          {chargeLink.isPending && (
            <div className="flex justify-center py-6">
              <OrbitaSpinner />
            </div>
          )}

          {chargeLink.isError && (
            <p className="text-sm text-destructive">{chargeLink.error.message}</p>
          )}

          {linkData && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Valor em aberto: <span className="font-medium text-foreground">{formatCurrency(linkData.openAmountCents)}</span>
              </p>

              {!linkData.hasPixKey && (
                <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div className="space-y-2">
                    <p>A empresa ainda não tem chave PIX. A página abre, mas sem o PIX para pagar.</p>
                    <Button size="sm" variant="outline" onClick={() => setIsPixSettingsOpen(true)}>
                      Cadastrar chave PIX
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Input readOnly value={linkData.url} onFocus={(event) => event.currentTarget.select()} />
                <Button size="icon" variant="outline" onClick={() => handleCopy(linkData.url)} aria-label="Copiar link">
                  <Copy className="size-4" />
                </Button>
                <Button size="icon" variant="outline" asChild aria-label="Abrir página">
                  <a href={linkData.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PixSettingsDialog isOpen={isPixSettingsOpen} onOpenChange={handlePixSettingsChange} />
    </>
  );
}
