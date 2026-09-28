"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  parseFile,
  type ParsedFileResult,
} from "@/features/contacts/hooks/import-lead";
import { useSendingNumbers } from "../hooks/use-sending-numbers";
import { useContactFilterOptions } from "../hooks/use-contacts";
import { useImportContacts } from "../hooks/use-import-contacts";

const NONE = "__none__";

/**
 * Importa contatos de planilha (CSV/XLS/XLSX) CRIANDO leads num tracking +
 * coluna escolhidos — assim os contatos entram na base e não se perdem.
 */
export function ImportContactsDialog() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedFileResult | null>(null);
  const [phoneColumn, setPhoneColumn] = useState("");
  const [nameColumn, setNameColumn] = useState(NONE);
  const [trackingId, setTrackingId] = useState<string>();
  const [statusId, setStatusId] = useState<string>();

  const { data: numbers } = useSendingNumbers({ enabled: open });
  const { data: options } = useContactFilterOptions(trackingId);
  const importContacts = useImportContacts();

  function reset() {
    setParsed(null);
    setPhoneColumn("");
    setNameColumn(NONE);
    setStatusId(undefined);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    try {
      const result = await parseFile(file);
      setParsed(result);
      setPhoneColumn(
        result.headers.find((header) =>
          /phone|telefone|celular|whats/i.test(header),
        ) ??
          result.headers[0] ??
          "",
      );
      setNameColumn(
        result.headers.find((header) => /name|nome/i.test(header)) ?? NONE,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao ler o arquivo",
      );
    }
  }

  function handleTracking(value: string) {
    setTrackingId(value);
    setStatusId(undefined);
  }

  function handleImport() {
    if (!parsed || !phoneColumn || !trackingId || !statusId) return;

    const leads = parsed.rows
      .map((row) => {
        const phone = row[phoneColumn]?.trim();
        const name =
          (nameColumn !== NONE ? row[nameColumn]?.trim() : "") || phone || "";
        if (!name) return null;
        return { name, phone: phone || undefined };
      })
      .filter(
        (lead): lead is { name: string; phone: string | undefined } =>
          lead !== null,
      );

    if (leads.length === 0) {
      toast.error("Nenhuma linha válida encontrada.");
      return;
    }

    importContacts.mutate(
      { leads, trackingId, statusId },
      {
        onSuccess: (result) => {
          const failed = result.errors.length;
          toast.success(
            `${result.imported} contato(s) importado(s)${
              failed > 0 ? ` · ${failed} ignorado(s)` : ""
            }.`,
          );
          reset();
          setOpen(false);
        },
        onError: (error) =>
          toast.error(error.message ?? "Falha ao importar contatos."),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="size-4" /> Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>
            Cria os contatos como leads no tracking escolhido — assim eles
            entram na base e ficam disponíveis para campanhas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-file">Arquivo (CSV, XLS ou XLSX)</Label>
            <input
              id="import-file"
              ref={inputRef}
              type="file"
              accept=".csv,.txt,.xls,.xlsx"
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {parsed && (
            <>
              <p className="text-sm text-muted-foreground">
                {parsed.totalRows} linha(s) detectada(s).
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Coluna de telefone</Label>
                  <Select value={phoneColumn} onValueChange={setPhoneColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {parsed.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Coluna de nome</Label>
                  <Select value={nameColumn} onValueChange={setNameColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Usar telefone</SelectItem>
                      {parsed.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Tracking de destino</Label>
                  <Select value={trackingId} onValueChange={handleTracking}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tracking" />
                    </SelectTrigger>
                    <SelectContent>
                      {numbers?.map((number) => (
                        <SelectItem
                          key={number.trackingId}
                          value={number.trackingId}
                        >
                          {number.trackingName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Coluna (etapa) inicial</Label>
                  <Select
                    value={statusId}
                    onValueChange={setStatusId}
                    disabled={!trackingId || !options?.columns.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.columns.map((column) => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              !parsed ||
              !phoneColumn ||
              !trackingId ||
              !statusId ||
              importContacts.isPending
            }
          >
            {importContacts.isPending ? "Importando..." : "Importar contatos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
