"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  FileCode2,
  RefreshCw,
  XCircle,
  Plus,
} from "lucide-react";
import {
  useFiscalInvoicesByContract,
  useRefreshFiscalInvoiceStatus,
  useCancelFiscalInvoice,
} from "../hooks/use-fiscal-invoices";
import { IssueInvoiceDialog } from "./issue-invoice-dialog";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  PROCESSANDO: {
    label: "Processando",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  AUTORIZADO: {
    label: "Autorizado",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  ERRO: {
    label: "Erro",
    className: "bg-red-100 text-red-600 border-red-200",
  },
  CANCELADO: {
    label: "Cancelado",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
} as const;

function fmtCurrency(v: string | number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtCompetencia(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
}

interface FiscalInvoiceItem {
  id: string;
  ref: string;
  status: keyof typeof STATUS_CONFIG;
  numero: string | null;
  valorServicos: string;
  dataCompetencia: string;
  urlDanfse: string | null;
  caminhoXmlStorage: string | null;
  caminhoXmlFocus: string | null;
  errorMessage: string | null;
  contractId: string | null;
}

interface ContractSnapshot {
  id: string;
  number: number;
  value: string;
  clientData: {
    name?: string | null;
    document?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
}

interface FiscalInvoiceCardProps {
  contract: ContractSnapshot;
}

function CancelInvoiceDialog({
  invoiceId,
  open,
  onClose,
}: {
  invoiceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [justificativa, setJustificativa] = useState("");
  const cancel = useCancelFiscalInvoice();

  const handleCancel = async () => {
    if (justificativa.length < 15) return;
    try {
      await cancel.mutateAsync({ id: invoiceId, justificativa });
      toast.success("Nota fiscal cancelada");
      onClose();
    } catch {
      toast.error("Erro ao cancelar nota fiscal");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar Nota Fiscal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            O cancelamento é definitivo e depende de aprovação do município.
          </p>
          <div className="space-y-1.5">
            <Label>Justificativa (mínimo 15 caracteres)</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo do cancelamento..."
            />
            <p className="text-xs text-muted-foreground text-right">
              {justificativa.length}/15
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={justificativa.length < 15 || cancel.isPending}
            onClick={handleCancel}
          >
            {cancel.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FiscalInvoiceCard({ contract }: FiscalInvoiceCardProps) {
  const { data, isLoading } = useFiscalInvoicesByContract(contract.id);
  const refresh = useRefreshFiscalInvoiceStatus();
  const [issueOpen, setIssueOpen] = useState(false);
  const [cancelInvoiceId, setCancelInvoiceId] = useState<string | null>(null);

  const invoices = (data?.invoices ?? []) as FiscalInvoiceItem[];
  const hasActiveInvoice = invoices.some(
    (invoice) => invoice.status === "PROCESSANDO" || invoice.status === "AUTORIZADO",
  );

  const handleRefresh = async (invoiceId: string) => {
    try {
      const result = await refresh.mutateAsync({ id: invoiceId });
      toast.success(`Status atualizado: ${result.status}`);
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  if (isLoading)
    return (
      <Card>
        <CardContent className="pt-4 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );

  return (
    <>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-[#7C3AED]" />
            Nota Fiscal
          </div>
          {!hasActiveInvoice && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-[#7C3AED]/40 text-[#7C3AED] hover:bg-[#7C3AED]/5"
              onClick={() => setIssueOpen(true)}
            >
              <Plus className="size-3.5" /> Emitir NFS-e
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Nenhuma nota fiscal emitida para este contrato.
            </p>
          ) : (
            invoices.map((invoice) => {
              const statusConfig =
                STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.PROCESSANDO;
              const xmlUrl =
                invoice.caminhoXmlStorage ?? invoice.caminhoXmlFocus;

              return (
                <div
                  key={invoice.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">
                          {invoice.numero ? `NFS-e #${invoice.numero}` : "NFS-e"}
                        </p>
                        <Badge className={cn("text-[10px]", statusConfig.className)}>
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Competência: {fmtCompetencia(invoice.dataCompetencia)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Valor: {fmtCurrency(invoice.valorServicos)}
                      </p>
                    </div>
                  </div>

                  {invoice.errorMessage && (
                    <p className="text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded-md px-3 py-2">
                      {invoice.errorMessage}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {invoice.status === "AUTORIZADO" && invoice.urlDanfse && (
                      <a
                        href={invoice.urlDanfse}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                          <FileText className="size-3.5" /> PDF
                        </Button>
                      </a>
                    )}
                    {invoice.status === "AUTORIZADO" && xmlUrl && (
                      <a
                        href={xmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                          <FileCode2 className="size-3.5" /> XML
                        </Button>
                      </a>
                    )}
                    {invoice.status === "PROCESSANDO" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-xs"
                        disabled={refresh.isPending}
                        onClick={() => handleRefresh(invoice.id)}
                      >
                        <RefreshCw
                          className={cn(
                            "size-3.5",
                            refresh.isPending && "animate-spin",
                          )}
                        />
                        Atualizar status
                      </Button>
                    )}
                    {invoice.status === "AUTORIZADO" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => setCancelInvoiceId(invoice.id)}
                      >
                        <XCircle className="size-3.5" /> Cancelar nota
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <IssueInvoiceDialog
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        contractId={contract.id}
        contractNumber={contract.number}
        contractValue={contract.value}
        clientData={contract.clientData}
      />

      {cancelInvoiceId && (
        <CancelInvoiceDialog
          invoiceId={cancelInvoiceId}
          open={!!cancelInvoiceId}
          onClose={() => setCancelInvoiceId(null)}
        />
      )}
    </>
  );
}
