"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Calculator, ChartColumn, ChevronLeft, ChevronRight, ExternalLink, Lock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryFormResponseById } from "@/features/form/hooks/use-form";
import { buildResponseSlug } from "@/features/form/lib/response-slug";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useFormRecords } from "@/features/form-records/hooks/use-form-records";
import { ALL_TIME_RANGE, DateRangeFilter, type DateRangeValue } from "./date-range-filter";
import { FormRecordsDashboard } from "./form-records-dashboard";
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

export function InternalQuickView({
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
export const FORM_RECORDS_SECTION_ID = "form-records-section";

export function FormRecordsSection({
  formId,
  title = "Fichas",
  dashboard,
}: {
  formId: string;
  title?: string;
  /** Com a tela inicial acima, o painel completo fica recolhido até pedirem. */
  dashboard?: { isOpen: boolean; onToggle: () => void };
}) {
  const [dateRange, setDateRange] = useState<DateRangeValue>(ALL_TIME_RANGE);
  const [leadId, setLeadId] = useState<string | undefined>();
  const [leadMemberId, setLeadMemberId] = useState<string | undefined>();
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

  const { data, isLoading, isError } = useFormRecords({ formId, dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo, leadId, leadMemberId, search: search || undefined, page });

  const hasFilter = Boolean(dateRange.dateFrom || dateRange.dateTo || leadId || leadMemberId || search);
  // Formulário sem fichas e sem colunas configuradas segue só com a tela de respostas de sempre.
  if (isError || (!isLoading && data && data.total === 0 && !hasFilter && data.columns.length === 0)) return null;
  if (isLoading && !data) return null;
  if (!data) return null;

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hasMembers = data.members.length > 0;
  // Com um cliente escolhido, o filtro mostra só os vinculados dele.
  const memberOptions = leadId ? data.members.filter((member) => member.leadId === leadId) : data.members;

  return (
    <section id={FORM_RECORDS_SECTION_ID} className="min-w-0 scroll-mt-16 space-y-3 py-5" aria-label="Fichas">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? "ficha" : "fichas"} · itens: {formatCents(data.usageSumCents)}
          </p>
        </div>
        {/* No celular: fechamento e busca na largura toda; filtros numa linha que rola. */}
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 md:w-auto">
          <Button asChild variant="outline" className="max-md:h-11 max-md:w-full" data-guide={GUIDE_ANCHORS.formRecordsClosingButton.id}>
            <Link href={`/form/responses/${formId}/fechamento`}>
              <Calculator className="size-4" />
              Fechamento por cliente
            </Link>
          </Button>
          <div className="relative max-md:w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              placeholder="Buscar"
              aria-label="Buscar fichas"
              onChange={(event) => setSearchText(event.target.value)}
              className="pl-9 max-md:h-11 md:w-44"
            />
          </div>
          <div className="scroll-hidden-x flex min-w-0 items-center gap-2 max-md:-mx-4 max-md:w-[calc(100%+2rem)] max-md:overflow-x-auto max-md:px-4">
          <DateRangeFilter
            value={dateRange}
            onChange={(nextRange) => {
              setDateRange(nextRange);
              setPage(1);
            }}
          />
          <Select
            value={leadId ?? ALL_FILTER}
            onValueChange={(value) => {
              setLeadId(value === ALL_FILTER ? undefined : value);
              setLeadMemberId(undefined);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44 shrink-0" aria-label="Cliente">
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
          {hasMembers && (
            <Select
              value={leadMemberId ?? ALL_FILTER}
              onValueChange={(value) => {
                setLeadMemberId(value === ALL_FILTER ? undefined : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44 shrink-0" aria-label="Vinculado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>Todos os vinculados</SelectItem>
                {memberOptions.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          </div>
        </div>
      </div>

      {dashboard && data.summary.recordCount > 0 && (
        <Button type="button" variant="outline" size="sm" aria-expanded={dashboard.isOpen} onClick={dashboard.onToggle}>
          <ChartColumn className="size-4" />
          {dashboard.isOpen ? "Ocultar painel" : "Ver painel completo"}
        </Button>
      )}
      {(!dashboard || dashboard.isOpen) && <FormRecordsDashboard summary={data.summary} />}

      {/* Celular: cartões com o essencial. Computador: tabela. */}
      <ul className="space-y-2 md:hidden" aria-label="Lista de fichas">
        {data.records.length === 0 ? (
          <li className="rounded-[22px] border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {hasFilter ? "Nenhuma ficha com esse filtro." : "Nenhuma ficha ainda."}
          </li>
        ) : (
          data.records.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => setOpenRecord({ responseId: record.responseId, label: record.label })}
                className="flex w-full min-w-0 flex-col gap-1 rounded-[18px] border bg-card p-3 text-left"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words text-sm font-medium">
                    {record.leadName ?? "Sem cliente"}
                    {record.leadMemberName ? ` · ${record.leadMemberName}` : ""}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums">{formatCents(record.usageTotalCents)}</span>
                </span>
                <span className="break-words text-xs text-muted-foreground">
                  {[formatRecordDate(record.referenceDate), record.label, ...data.columns.map((column) => record.values[column.key]).filter(Boolean)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="text-xs text-muted-foreground">{record.isClosed ? "Fechada" : record.isFinalized ? "Enviada" : "Rascunho"}</span>
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="overflow-x-auto rounded-[18px] border max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              {hasMembers && <TableHead>Vinculado</TableHead>}
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
                <TableCell colSpan={data.columns.length + (hasMembers ? 5 : 4)} className="h-24 text-center text-muted-foreground">
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
                  {hasMembers && <TableCell>{record.leadMemberName ?? "—"}</TableCell>}
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
