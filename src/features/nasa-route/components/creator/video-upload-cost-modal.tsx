"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { AlertTriangle, HardDrive, Sparkles } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/features/nasa-route/lib/video-storage-pricing";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  courseId: string;
  file: File | null;
}

/**
 * Mostra a quote (custo em STARs) antes de iniciar o upload. Bloqueia
 * "Confirmar" se saldo é insuficiente e oferece "Comprar STARs".
 */
export function VideoUploadCostModal({
  open,
  onClose,
  onConfirm,
  courseId,
  file,
}: Props) {
  const [isConfirming, setIsConfirming] = useState(false);

  const enabled = open && !!file;
  const sizeBytes = file?.size ?? 0;

  const quoteQ = useQuery({
    ...orpc.nasaRoute.creatorQuoteVideoUpload.queryOptions({
      input: { courseId, sizeBytes },
    }),
    enabled,
    staleTime: 0,
  });

  useEffect(() => {
    if (!open) setIsConfirming(false);
  }, [open]);

  const quote = quoteQ.data;
  const canConfirm = quote?.hasSufficientBalance && !isConfirming;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="size-5 text-info" />
            Hospedagem do vídeo
          </DialogTitle>
          <DialogDescription>
            Vídeo armazenado no nosso storage R2 — custo cobrado uma única vez em STARs.
          </DialogDescription>
        </DialogHeader>

        {quoteQ.isLoading && (
          <div className="flex items-center justify-center py-8">
            <OrbitaSpinner className="size-6 text-muted-foreground" />
          </div>
        )}

        {quoteQ.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Não foi possível calcular o custo.{" "}
            {(quoteQ.error as any)?.message ?? "Tente novamente."}
          </div>
        )}

        {quote && file && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Arquivo</span>
                <span className="font-medium" title={file.name}>
                  {file.name.length > 28 ? file.name.slice(0, 28) + "…" : file.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tamanho</span>
                <span className="font-medium">{formatFileSize(sizeBytes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hospedagem garantida</span>
                <span className="font-medium">{quote.breakdown.horizonMonths} meses</span>
              </div>
            </div>

            <div className="flex items-baseline justify-between rounded-lg border border-info/30 bg-info/10 p-3">
              <div className="text-sm text-info">
                Custo total
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-info">
                  {quote.costStars.toLocaleString("pt-BR")}
                </span>
                <Sparkles className="size-4 text-info" />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Seu saldo atual:{" "}
              <strong>{quote.currentBalance.toLocaleString("pt-BR")} ★</strong>
              {!quote.hasSufficientBalance && (
                <span className="text-destructive">
                  {" "}
                  · faltam{" "}
                  {(quote.costStars - quote.currentBalance).toLocaleString("pt-BR")} ★
                </span>
              )}
            </div>

            {!quote.hasSufficientBalance && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                <AlertTriangle className="mt-0.5 size-4 flex-shrink-0" />
                <span>
                  Saldo insuficiente. Compre STARs em{" "}
                  <a
                    href="/settings/stars"
                    className="font-medium underline hover:opacity-80"
                  >
                    Configurações → STARs
                  </a>{" "}
                  e volte aqui.
                </span>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Esse valor cobre {quote.breakdown.horizonMonths} meses de hospedagem +
              banda de tráfego dos alunos. Não é reembolsável em caso de cancelamento.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isConfirming}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setIsConfirming(true);
              onConfirm();
            }}
            disabled={!canConfirm}
            className="gap-1.5"
          >
            {isConfirming ? (
              <OrbitaSpinner className="size-4 " />
            ) : (
              <Sparkles className="size-4" />
            )}
            Confirmar e iniciar upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
