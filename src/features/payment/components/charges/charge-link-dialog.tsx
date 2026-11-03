"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Zap, Copy, ExternalLink, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogBody,
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

// Por que a cobrança saiu com o PIX estático mesmo com o banco conectado (spec 0130, RF-8).
const BANK_FALLBACK_LABELS: Record<string, string> = {
  no_debtor_document: "o cliente não tem CPF ou CNPJ cadastrado, e o banco exige.",
  certificate_expired: "o certificado do banco venceu. Troque em Contas para voltar a baixa automática.",
  charge_removed: "o PIX desta conta foi cancelado no banco e não pode ser reaberto.",
  bank_error: "o banco recusou ou está fora do ar. Veja a conexão em Contas.",
  timeout: "o banco demorou a responder. Abra de novo em instantes.",
  boleto_processing: "o banco ainda está gerando o boleto. Abra de novo em instantes.",
};

// Boleto ligado, mas esta conta saiu só com PIX (spec 0133, RF-3).
const BOLETO_SKIP_LABELS: Record<string, string> = {
  missing_address: "falta o endereço completo do cliente (CEP, rua, cidade e UF). Preencha no contato.",
  below_minimum: "o banco só emite boleto a partir de R$ 2,50.",
  boleto_failed: "o banco não conseguiu emitir o boleto desta conta.",
};

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
        <DialogContent scrollable className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link de pagamento</DialogTitle>
            <DialogDescription>
              {entryName ? `"${entryName}". ` : ""}
              O cliente abre a página, vê o valor e paga pelo PIX. A régua de cobrança envia este mesmo link.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">

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

                {linkData.boletoDigitableLine && (
                  <p className="flex items-center gap-1.5 text-xs text-success">
                    <Zap className="size-3.5" /> Boleto com PIX gerado no banco: baixa automática pelos dois.
                  </p>
                )}
                {linkData.boletoSkippedReason && (
                  <p className="text-xs text-warning">
                    Esta cobrança sai só com PIX: {BOLETO_SKIP_LABELS[linkData.boletoSkippedReason] ?? "o boleto não pôde ser emitido."}
                  </p>
                )}
                {linkData.pixSource === "BANK" && !linkData.boletoDigitableLine && (
                  <p className="flex items-center gap-1.5 text-xs text-success">
                    <Zap className="size-3.5" /> PIX gerado no banco: a conta é baixada sozinha quando o cliente pagar.
                  </p>
                )}
                {linkData.pixSource === "STATIC" && linkData.bankFallbackReason && (
                  <p className="text-xs text-warning">
                    PIX com a chave da empresa, sem baixa automática: {BANK_FALLBACK_LABELS[linkData.bankFallbackReason] ?? "o banco não respondeu."}
                  </p>
                )}

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
          </DialogBody>
        </DialogContent>
      </Dialog>
      <PixSettingsDialog isOpen={isPixSettingsOpen} onOpenChange={handlePixSettingsChange} />
    </>
  );
}
