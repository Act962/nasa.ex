import { useState, useCallback, useRef } from "react";
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
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  ArrowRight,
  ArrowLeft,
  Download,
  AlertTriangle,
} from "lucide-react";
import {
  parseFile,
  LEAD_FIELDS,
  buildImportPayload,
  importLeads,
  type ParsedFileResult,
  type ColumnMapping,
} from "@/features/contacts/hooks/import-lead";
import { useMutationImport } from "./hooks/use-import";
import { useQueryTracking } from "../tracking-settings/hooks/use-tracking";
import { useStatus } from "../status/hooks/use-status";

interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (result: { imported: number }) => void;
}

type Step = "upload" | "mapping" | "preview" | "importing" | "done";

interface ImportError {
  name: string;
  phone?: string;
  reason: string;
  rowIndex: number;
}

// Helper function to download errors as CSV
function downloadErrorsAsCSV(errors: ImportError[]) {
  const headers = ["Linha", "Nome", "Telefone", "Motivo"];
  const rows = errors.map((e) => [e.rowIndex, e.name, e.phone || "", e.reason]);

  const csvContent = [
    headers,
    ...rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          // Escapar aspas e envolver em aspas se contiver vírgula ou aspas
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `leads-erros-${new Date().getTime()}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function LeadImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: LeadImportDialogProps) {
  const mutation = useMutationImport();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFileResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [isWithConversation, setIsWithConversation] = useState(false);

  const trackings = useQueryTracking();
  const status = useStatus(trackingId);
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: ImportError[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setParsed(null);
    setMapping({});
    setError(null);
    setImportResult(null);
  }, []);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) reset();
      onOpenChange(open);
    },
    [onOpenChange, reset],
  );

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    setFile(f);
    try {
      const result = await parseFile(f);
      if (result.rows.length === 0) {
        setError("O arquivo está vazio ou não possui dados válidos.");
        return;
      }
      setParsed(result);
      // Auto-map by similarity
      const autoMapping: ColumnMapping = {};
      const nameMap: Record<string, string> = {
        nome: "name",
        name: "name",
        email: "email",
        "e-mail": "email",
        telefone: "phone",
        phone: "phone",
        celular: "phone",
        whatsapp: "phone",
        documento: "document",
        cpf: "document",
        cnpj: "document",
        document: "document",
        descricao: "description",
        descrição: "description",
        description: "description",
        valor: "amount",
        value: "amount",
        amount: "amount",
        temperatura: "temperature",
        temperature: "temperature",
        origem: "source",
        source: "source",
        perfil: "profile",
        profile: "profile",
        data: "createdAt",
        datadeentrada: "createdAt",
        "data de entrada": "createdAt",
        createdat: "createdAt",
      };
      result.headers.forEach((h) => {
        const key = h
          .toLowerCase()
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (nameMap[key]) autoMapping[h] = nameMap[key];
      });
      setMapping(autoMapping);
      setStep("mapping");
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleImport = () => {
    if (!parsed) return;
    setStep("importing");
    setError(null);

    const payload = buildImportPayload(parsed.rows, mapping);
    mutation.mutate(
      {
        leads: payload.leads,
        statusId,
        trackingId,
      },

      {
        onSuccess: (result) => {
          setImportResult({
            imported: result.imported,
            errors: result.errors,
          });
          setStep("done");
          onImportComplete?.({ imported: result.imported });
          setTrackingId("");
          setStatusId("");
        },
        onError: (err) => {
          setError(err.message);
          setStep("preview");
        },
      },
    );
  };

  const mappedRequiredFields = LEAD_FIELDS.filter((f) => f.required);
  const allRequiredMapped = mappedRequiredFields.every((f) =>
    Object.values(mapping).includes(f.key),
  );

  const previewRows = parsed?.rows.slice(0, 5) || [];

  const isDisabled = !trackingId || !statusId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            Importar Leads
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Envie um arquivo CSV ou planilha (XLS/XLSX) com os dados dos leads."}
            {step === "mapping" &&
              "Mapeie as colunas do arquivo para os campos do lead."}
            {step === "preview" && "Confira os dados antes de importar."}
            {step === "importing" && "Importando leads..."}
            {step === "done" && "Importação concluída!"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {/* UPLOAD STEP */}
          {step === "upload" && (
            <div
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground mb-1">
                Arraste o arquivo aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: CSV, XLS, XLSX
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv,.xls,.xlsx,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          )}

          {/* MAPPING STEP */}
          {step === "mapping" && parsed && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{file?.name}</span>
                <span className="ml-auto shrink-0">
                  {parsed.totalRows} linhas
                </span>
              </div>

              <div className="space-y-2">
                {parsed.headers.map((header) => (
                  <div key={header} className="flex items-center gap-3">
                    <span
                      className="text-sm text-foreground w-40 truncate shrink-0"
                      title={header}
                    >
                      {header}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Select
                      value={mapping[header] || "__skip__"}
                      onValueChange={(v) =>
                        setMapping((m) => ({ ...m, [header]: v }))
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Ignorar coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">— Ignorar —</SelectItem>
                        {LEAD_FIELDS.map((field) => (
                          <SelectItem key={field.key} value={field.key}>
                            {field.label}
                            {field.required ? " *" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {!allRequiredMapped && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Campos obrigatórios:{" "}
                  {mappedRequiredFields.map((f) => f.label).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* PREVIEW STEP */}
          {step === "preview" && parsed && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Prévia dos primeiros {previewRows.length} de {parsed.totalRows}{" "}
                leads:
              </p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      {Object.entries(mapping)
                        .filter(([, v]) => v !== "__skip__")
                        .map(([csvCol, fieldKey]) => {
                          const field = LEAD_FIELDS.find(
                            (f) => f.key === fieldKey,
                          );
                          return (
                            <th
                              key={csvCol}
                              className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap"
                            >
                              {field?.label || fieldKey}
                            </th>
                          );
                        })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {Object.entries(mapping)
                          .filter(([, v]) => v !== "__skip__")
                          .map(([csvCol]) => (
                            <td
                              key={csvCol}
                              className="px-3 py-1.5 text-muted-foreground whitespace-nowrap max-w-50 truncate"
                            >
                              {row[csvCol] || "—"}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-foreground">
                    Funil
                  </label>
                  <Select value={trackingId} onValueChange={setTrackingId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o funil" />
                    </SelectTrigger>
                    <SelectContent>
                      {trackings.trackings?.map((tracking) => (
                        <SelectItem key={tracking.id} value={tracking.id}>
                          {tracking.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-foreground">
                    Status inicial
                  </label>
                  <Select
                    value={statusId}
                    onValueChange={setStatusId}
                    disabled={!trackingId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          !trackingId
                            ? "Selecione um funil antes"
                            : "Selecione o status"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {status.status.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: s.color ?? "#1447e6" }}
                            />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Total:{" "}
                <strong className="text-foreground">{parsed.totalRows}</strong>{" "}
                leads serão importados.
              </p>
            </div>
          )}

          {/* IMPORTING STEP */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Importando {parsed?.totalRows} leads...
              </p>
            </div>
          )}

          {/* DONE STEP */}
          {step === "done" && importResult && (
            <div className="flex flex-col gap-4">
              {/* Success Summary */}
              <div className="flex items-start gap-3 bg-green-50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-900">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                    {importResult.imported} leads importados com sucesso
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-200 mt-1">
                    Estes leads foram adicionados ao funil e estão prontos para
                    uso.
                  </p>
                </div>
              </div>

              {/* Failed Leads Table */}
              {importResult.errors.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-900">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                        {importResult.errors.length} leads não foram importados
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-200 mt-1">
                        Abaixo estão os leads que encontraram problemas durante
                        a importação.
                      </p>
                    </div>
                  </div>

                  {/* Table with failed leads */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                              Linha
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                              Nome
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                              Telefone
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                              Motivo
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {importResult.errors.map((error, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                #{error.rowIndex}
                              </td>
                              <td className="px-3 py-2 text-sm truncate max-w-xs">
                                {error.name}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {error.phone || "—"}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-destructive/10 text-destructive dark:bg-destructive/20">
                                  {error.reason}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Download button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadErrorsAsCSV(importResult.errors)}
                    className="w-full gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Baixar lista de erros (CSV)
                  </Button>
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div className="flex flex-col">
                  <p className="text-xs text-muted-foreground">
                    Taxa de sucesso
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {importResult.imported + importResult.errors.length === 0
                      ? "0%"
                      : (
                          (importResult.imported /
                            (importResult.imported +
                              importResult.errors.length)) *
                          100
                        ).toFixed(1) + "%"}
                  </p>
                </div>
                <div className="flex flex-col">
                  <p className="text-xs text-muted-foreground">
                    Total processado
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {importResult.imported + importResult.errors.length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 mt-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-x-2">
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button
                disabled={!allRequiredMapped}
                onClick={() => setStep("preview")}
              >
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button disabled={isDisabled} onClick={handleImport}>
                Importar {parsed?.totalRows} leads
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
