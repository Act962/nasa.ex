"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Lock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryFormResponseById } from "@/features/form/hooks/use-form";
import { buildResponseSlug } from "@/features/form/lib/response-slug";
import { useFormRecords } from "@/features/form-records/hooks/use-form-records";
import { formatCents } from "@/features/form-records/lib/measure-units";
import { FormRecordQuickView, parseFormBlocks, parseResponseValues } from "./form-record-quick-view";

const FormPrintButton = dynamic(
  () => import("@/features/form/components/pdf/form-print-button").then((module_) => ({ default: module_.FormPrintButton })),
  { ssr: false },
);

const ALL_FILTER = "all";
const SEARCH_DEBOUNCE_MS = 300;

/** "2026-09" → "setembro de 2026". */
export function formatPeriodKey(periodKey: string): string {
  const [year, month] = periodKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatRecordDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function InternalQuickView({
  responseId,
  label,
  onClose,
}: {
  responseId: string;
  label: string | null;
  onClose: () => void;
}) {
  const { response, isLoading } = useQueryFormResponseById(responseId);
  const blocks = parseFormBlocks(response?.form?.jsonBlock);
  const responseValues = parseResponseValues(response?.jsonResponse);
  const formName = response?.form?.name ?? "Ficha";

  return (
    <FormRecordQuickView
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={label ? `${formName} · ${label}` : formName}
      subtitle={response?.lead?.name ? `Cliente: ${response.lead.name}` : undefined}
      recordKey={responseId}
      blocks={blocks}
      settings={response?.form?.settings}
      responseValues={responseValues}
      isLoading={isLoading}
      actions={
        response && (
          <>
            <FormPrintButton blocks={blocks} formName={formName} leadName={response.lead?.name ?? undefined} responseValues={responseValues} />
            <Button asChild size="sm">
              <Link href={`/formulario/${buildResponseSlug(formName, response.createdAt)}/${responseId}`}>
                <ExternalLink className="size-4" />
                Abrir ficha
              </Link>
            </Button>
          </>
        )
      }
    />
  );
}

/**
 * Lista de fichas de um formulário (spec 0075, RF-9). Não aparece para
 * formulário que não usa os recursos de ficha.
 */
export function FormRecordsSection({ formId }: { formId: string }) {
  const [periodKey, setPeriodKey] = useState<string | undefined>();
  const [leadId, setLeadId] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openRecord, setOpenRecord] = useState<{ responseId: string; label: string | null } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const { data, isLoading, isError } = useFormRecords({ formId, periodKey, leadId, search: search || undefined, page });

  const hasFilter = Boolean(periodKey || leadId || search);
  // Formulário sem fichas e sem colunas configuradas segue só com a tela de respostas de sempre.
  if (isError || (!isLoading && data && data.total === 0 && !hasFilter && data.columns.length === 0)) return null;
  if (isLoading && !data) return null;
  if (!data) return null;

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <section className="space-y-3 py-5" aria-label="Fichas">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Fichas</h2>
          <p className="text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? "ficha" : "fichas"} · itens: {formatCents(data.usageSumCents)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              placeholder="Buscar"
              aria-label="Buscar fichas"
              onChange={(event) => setSearchText(event.target.value)}
              className="w-44 pl-9"
            />
          </div>
          <Select
            value={periodKey ?? ALL_FILTER}
            onValueChange={(value) => {
              setPeriodKey(value === ALL_FILTER ? undefined : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>Todos os períodos</SelectItem>
              {data.periodKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {formatPeriodKey(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={leadId ?? ALL_FILTER}
            onValueChange={(value) => {
              setLeadId(value === ALL_FILTER ? undefined : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Cliente">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>Todos os clientes</SelectItem>
              {data.clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              {data.columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
              <TableHead className="text-right">Itens</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={data.columns.length + 4} className="h-24 text-center text-muted-foreground">
                  {hasFilter ? "Nenhuma ficha com esse filtro." : "Nenhuma ficha ainda."}
                </TableCell>
              </TableRow>
            ) : (
              data.records.map((record) => (
                <TableRow
                  key={record.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver ficha ${record.label ?? formatRecordDate(record.referenceDate)}`}
                  className="cursor-pointer"
                  onClick={() => setOpenRecord({ responseId: record.responseId, label: record.label })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpenRecord({ responseId: record.responseId, label: record.label });
                    }
                  }}
                >
                  <TableCell className="whitespace-nowrap">{formatRecordDate(record.referenceDate)}</TableCell>
                  <TableCell>{record.leadName ?? "Sem cliente"}</TableCell>
                  {data.columns.map((column) => (
                    <TableCell key={column.key}>{record.values[column.key] || "—"}</TableCell>
                  ))}
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCents(record.usageTotalCents)}</TableCell>
                  <TableCell>
                    {record.isClosed ? (
                      <Badge variant="secondary">
                        <Lock className="size-3" />
                        Fechada
                      </Badge>
                    ) : record.isFinalized ? (
                      <Badge variant="secondary">Enviada</Badge>
                    ) : (
                      <Badge variant="outline">Rascunho</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <span className="text-muted-foreground">
            {page} de {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Próxima
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {openRecord && (
        <InternalQuickView responseId={openRecord.responseId} label={openRecord.label} onClose={() => setOpenRecord(null)} />
      )}
    </section>
  );
}
