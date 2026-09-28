"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { useAddRecipientsFromCsv } from "../../hooks/use-broadcast-audience";

const NONE = "__none__";

/**
 * Aba "CSV / Planilha" — reusa o parser de contatos (`parseFile`) e mapeia as
 * colunas de telefone e nome. Colunas restantes viram `variables` por linha.
 */
export function CsvAudienceTab({ broadcastId }: { broadcastId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedFileResult | null>(null);
  const [phoneColumn, setPhoneColumn] = useState<string>("");
  const [nameColumn, setNameColumn] = useState<string>(NONE);

  const addRecipients = useAddRecipientsFromCsv(broadcastId);

  async function handleFile(file: File) {
    try {
      const result = await parseFile(file);
      setParsed(result);
      const guessedPhone = result.headers.find((header) =>
        /phone|telefone|celular|whats/i.test(header),
      );
      const guessedName = result.headers.find((header) =>
        /name|nome/i.test(header),
      );
      setPhoneColumn(guessedPhone ?? result.headers[0] ?? "");
      setNameColumn(guessedName ?? NONE);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao ler o arquivo",
      );
    }
  }

  function handleImport() {
    if (!parsed || !phoneColumn) return;

    const rows = parsed.rows
      .map((row) => {
        const phone = row[phoneColumn]?.trim();
        if (!phone) return null;

        const variables: Record<string, string> = {};
        for (const header of parsed.headers) {
          if (header === phoneColumn || header === nameColumn) continue;
          const value = row[header]?.trim();
          if (value) variables[header] = value;
        }

        return {
          phone,
          name: nameColumn !== NONE ? row[nameColumn]?.trim() : undefined,
          variables: Object.keys(variables).length > 0 ? variables : undefined,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length === 0) {
      toast.error("Nenhuma linha com telefone válido.");
      return;
    }

    addRecipients.mutate(
      { broadcastId, rows },
      {
        onSuccess: (result) => {
          toast.success(
            `${result.added} destinatário(s) adicionado(s). Total: ${result.totalRecipients}.`,
          );
          setParsed(null);
          if (inputRef.current) inputRef.current.value = "";
        },
        onError: (error) => {
          toast.error(error.message ?? "Falha ao importar planilha");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="csv-file">Arquivo (CSV, XLS ou XLSX)</Label>
        <input
          id="csv-file"
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
          <div className="grid gap-4 sm:grid-cols-2">
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
              <Label>Coluna de nome (opcional)</Label>
              <Select value={nameColumn} onValueChange={setNameColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {parsed.headers.map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Button
              onClick={handleImport}
              disabled={!phoneColumn || addRecipients.isPending}
            >
              {addRecipients.isPending ? "Importando…" : "Importar destinatários"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
