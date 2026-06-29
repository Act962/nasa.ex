"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle2,
  Settings2,
  Filter,
} from "lucide-react";
import { useQueryTracking } from "../tracking-settings/hooks/use-tracking";
import { useStatus } from "../status/hooks/use-status";
import { useMutationExport } from "./hooks/use-export";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { toast } from "sonner";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useCheckPermission } from "@/hooks/use-check-permission";

interface LeadExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXPORT_FIELDS = [
  { key: "name", label: "Nome" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "document", label: "Documento" },
  { key: "description", label: "Descrição" },
  { key: "amount", label: "Valor" },
  { key: "temperature", label: "Temperatura" },
  { key: "source", label: "Origem" },
  { key: "profile", label: "Perfil" },
  { key: "createdAt", label: "Data de Entrada" },
  { key: "statusName", label: "Status" },
  { key: "responsibleName", label: "Responsável" },
];

export function LeadExportDialog({
  open,
  onOpenChange,
}: LeadExportDialogProps) {
  const [trackingId, setTrackingId] = useState("");
  const [statusId, setStatusId] = useState("all");
  const [format, setFormat] = useState<"csv" | "xlsx">("xlsx");
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.map((f) => f.key),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [done, setDone] = useState(false);

  const trackings = useQueryTracking();
  const status = useStatus(trackingId);
  const mutation = useMutationExport();
  const { checkPermission } = useCheckPermission();

  const canExport = checkPermission("tracking", "canView");

  if (!canExport && open) {
    return null;
  }

  const handleExport = async () => {
    if (!trackingId) {
      toast.error("Selecione um funil");
      return;
    }

    setIsExporting(true);
    mutation.mutate(
      {
        trackingId,
        statusId: statusId === "all" ? undefined : statusId,
      },
      {
        onSuccess: (data) => {
          if (data.leads.length === 0) {
            toast.error("Nenhum lead encontrado para exportar");
            setIsExporting(false);
            return;
          }

          const exportData = data.leads.map((lead: any) => {
            const row: any = {};
            selectedFields.forEach((fieldKey) => {
              const field = EXPORT_FIELDS.find((f) => f.key === fieldKey);
              if (field) {
                let value = lead[fieldKey];
                if (fieldKey === "createdAt") {
                  value = new Date(value).toLocaleString("pt-BR");
                }
                if (fieldKey === "profile") {
                  value = useConstructUrl(value);
                }
                row[field.label] = value ?? "";
              }
            });
            return row;
          });

          if (format === "csv") {
            const csv = Papa.unparse(exportData);
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", `leads-${new Date().getTime()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else {
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Leads");
            XLSX.writeFile(wb, `leads-${new Date().getTime()}.xlsx`);
          }

          setIsExporting(false);
          setDone(true);
        },
        onError: (error) => {
          toast.error("Erro ao exportar leads: " + error.message);
          setIsExporting(false);
        },
      },
    );
  };

  const toggleField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const reset = () => {
    setTrackingId("");
    setStatusId("all");
    setDone(false);
    setIsExporting(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) setTimeout(reset, 300);
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Exportar Leads
          </DialogTitle>
          <DialogDescription>
            Escolha os filtros e campos que deseja exportar.
          </DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Filter className="size-4" /> Filtros
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Funil</Label>
                  <Select value={trackingId} onValueChange={setTrackingId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o funil" />
                    </SelectTrigger>
                    <SelectContent>
                      {trackings.trackings?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={statusId}
                    onValueChange={setStatusId}
                    disabled={!trackingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {status.status.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Settings2 className="size-4" /> Campos para Exportar
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EXPORT_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`field-${field.key}`}
                      checked={selectedFields.includes(field.key)}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                    <Label
                      htmlFor={`field-${field.key}`}
                      className="text-xs cursor-pointer"
                    >
                      {field.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Formato do Arquivo</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="xlsx"
                    checked={format === "xlsx"}
                    onChange={() => setFormat("xlsx")}
                    className="accent-primary"
                  />
                  <span className="text-sm">Excel (.xlsx)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="csv"
                    checked={format === "csv"}
                    onChange={() => setFormat("csv")}
                    className="accent-primary"
                  />
                  <span className="text-sm">CSV (.csv)</span>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-lg font-semibold">Exportação Concluída!</p>
              <p className="text-sm text-muted-foreground">
                Seu download deve começar automaticamente.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          {!done ? (
            <Button
              className="w-full sm:w-auto gap-2"
              onClick={handleExport}
              disabled={
                isExporting || !trackingId || selectedFields.length === 0
              }
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Exportar
                </>
              )}
            </Button>
          ) : (
            <Button
              className="w-full sm:w-auto"
              onClick={() => handleClose(false)}
            >
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
