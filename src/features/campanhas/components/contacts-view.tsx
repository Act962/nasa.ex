"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSendingNumbers } from "../hooks/use-sending-numbers";
import {
  useContacts,
  useContactFilterOptions,
  type ContactFilters,
} from "../hooks/use-contacts";
import { PageHeader } from "./page-header";
import { AttachToCampaignDialog } from "./attach-to-campaign-dialog";
import { ImportContactsDialog } from "./import-contacts-dialog";

type Temperature = "COLD" | "WARM" | "HOT" | "VERY_HOT";

const TEMPERATURES: Array<{ value: Temperature; label: string; dot: string }> = [
  { value: "COLD", label: "Frio", dot: "bg-sky-500" },
  { value: "WARM", label: "Morno", dot: "bg-amber-500" },
  { value: "HOT", label: "Quente", dot: "bg-orange-500" },
  { value: "VERY_HOT", label: "Muito quente", dot: "bg-red-500" },
];

const TEMP_DOT: Record<string, string> = {
  COLD: "bg-sky-500",
  WARM: "bg-amber-500",
  HOT: "bg-orange-500",
  VERY_HOT: "bg-red-500",
};
const TEMP_LABEL: Record<string, string> = {
  COLD: "Frio",
  WARM: "Morno",
  HOT: "Quente",
  VERY_HOT: "Muito quente",
};

const ALL = "__all__";

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function ContactsView() {
  const { data: numbers } = useSendingNumbers();

  const [trackingId, setTrackingId] = useState<string>();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput);
  const [action, setAction] = useState<"ACTIVE" | "WON" | "LOST">("ACTIVE");
  const [temperatures, setTemperatures] = useState<Temperature[]>([]);
  const [statusId, setStatusId] = useState<string>();
  const [participant, setParticipant] = useState<string>();
  const [tagSlugs, setTagSlugs] = useState<string[]>([]);
  const [dateInit, setDateInit] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(30);

  const { data: options } = useContactFilterOptions(trackingId);

  useEffect(() => {
    setStatusId(undefined);
    setParticipant(undefined);
  }, [trackingId]);

  const filters: ContactFilters = useMemo(
    () => ({
      trackingId,
      actionFilter: action,
      search: search || undefined,
      statusIds: statusId ? [statusId] : undefined,
      participantFilter: participant,
      temperatureFilter: temperatures.length ? temperatures : undefined,
      tagsFilter: tagSlugs.length ? tagSlugs : undefined,
      dateInit: dateInit && dateEnd ? dateInit : undefined,
      dateEnd: dateInit && dateEnd ? dateEnd : undefined,
    }),
    [
      trackingId,
      action,
      search,
      statusId,
      participant,
      temperatures,
      tagSlugs,
      dateInit,
      dateEnd,
    ],
  );

  // Trocar filtros zera a seleção e volta pra primeira página.
  useEffect(() => {
    setSelectedIds(new Set());
    setAllMatching(false);
    setPage(0);
  }, [filters]);

  const { data, isLoading, isFetching } = useContacts(filters, page, pageSize);

  const contacts = data?.contacts ?? [];
  const totalCount = data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  const activeFilterCount =
    temperatures.length +
    (statusId ? 1 : 0) +
    (participant ? 1 : 0) +
    tagSlugs.length +
    (dateInit && dateEnd ? 1 : 0);

  const loadedIds = contacts.map((contact) => contact.id);
  const allLoadedSelected =
    loadedIds.length > 0 && loadedIds.every((id) => selectedIds.has(id));
  const headerState: boolean | "indeterminate" = allMatching
    ? true
    : allLoadedSelected
      ? true
      : selectedIds.size > 0
        ? "indeterminate"
        : false;
  const selectedCount = allMatching ? totalCount : selectedIds.size;
  const hasSelection = allMatching || selectedIds.size > 0;
  const hasMorePages = totalCount > contacts.length;

  function toggleRow(id: string) {
    if (allMatching) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleHeader() {
    if (allMatching) {
      setAllMatching(false);
      setSelectedIds(new Set());
      return;
    }
    if (allLoadedSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(loadedIds));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setAllMatching(false);
  }

  function toggleTemperature(value: Temperature) {
    setTemperatures((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }
  function toggleTag(slug: string) {
    setTagSlugs((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );
  }
  function clearFilters() {
    setTemperatures([]);
    setStatusId(undefined);
    setParticipant(undefined);
    setTagSlugs([]);
    setDateInit("");
    setDateEnd("");
  }

  const buildAttachInput = (broadcastId: string) =>
    allMatching
      ? { broadcastId, allMatching: filters }
      : { broadcastId, leadIds: [...selectedIds] };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title="Contatos"
        description="Selecione contatos e atrele a uma campanha para disparar."
        action={<ImportContactsDialog />}
      />

      {/* ── Filtros ── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="pl-9"
            />
          </div>
          <Select
            value={trackingId ?? ALL}
            onValueChange={(value) =>
              setTrackingId(value === ALL ? undefined : value)
            }
          >
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Tracking" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os trackings</SelectItem>
              {numbers?.map((number) => (
                <SelectItem key={number.trackingId} value={number.trackingId}>
                  {number.trackingName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={action}
            onValueChange={(value) => setAction(value as typeof action)}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Ativos</SelectItem>
              <SelectItem value="WON">Ganhos</SelectItem>
              <SelectItem value="LOST">Perdidos</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters((current) => !current)}
            className="shrink-0"
          >
            <SlidersHorizontal className="size-4" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-background/20 px-1.5 text-xs">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4">
            <FilterGroup label="Temperatura">
              {TEMPERATURES.map((item) => (
                <Chip
                  key={item.value}
                  active={temperatures.includes(item.value)}
                  onClick={() => toggleTemperature(item.value)}
                >
                  <span className={cn("size-2 rounded-full", item.dot)} />
                  {item.label}
                </Chip>
              ))}
            </FilterGroup>

            {trackingId && options && options.columns.length > 0 && (
              <FilterGroup label="Coluna do tracking">
                <Select
                  value={statusId ?? ALL}
                  onValueChange={(value) =>
                    setStatusId(value === ALL ? undefined : value)
                  }
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Todas as colunas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas as colunas</SelectItem>
                    {options.columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterGroup>
            )}

            {trackingId && options && options.participants.length > 0 && (
              <FilterGroup label="Participante">
                <Select
                  value={participant ?? ALL}
                  onValueChange={(value) =>
                    setParticipant(value === ALL ? undefined : value)
                  }
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {options.participants.map((user) => (
                      <SelectItem key={user.email} value={user.email}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterGroup>
            )}

            {options && options.tags.length > 0 && (
              <FilterGroup label="Tags">
                {options.tags.map((tag) => (
                  <Chip
                    key={tag.id}
                    active={tagSlugs.includes(tag.slug)}
                    onClick={() => toggleTag(tag.slug)}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </Chip>
                ))}
              </FilterGroup>
            )}

            <FilterGroup label="Criados entre">
              <Input
                type="date"
                value={dateInit}
                onChange={(event) => setDateInit(event.target.value)}
                className="w-full sm:w-40"
              />
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="date"
                value={dateEnd}
                onChange={(event) => setDateEnd(event.target.value)}
                className="w-full sm:w-40"
              />
            </FilterGroup>

            {activeFilterCount > 0 && (
              <div>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="size-4" /> Limpar filtros
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Barra de seleção ── */}
      {hasSelection && (
        <div className="flex flex-col gap-2 rounded-xl border bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">
              {allMatching
                ? "Todos os contatos que casam com o filtro"
                : `${selectedCount} contato(s) selecionado(s)`}
            </span>
            {!allMatching && allLoadedSelected && hasMorePages && (
              <button
                type="button"
                onClick={() => setAllMatching(true)}
                className="text-primary underline underline-offset-2"
              >
                Selecionar todos os {totalCount} que casam com o filtro
              </button>
            )}
            <button
              type="button"
              onClick={clearSelection}
              className="text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          </div>
          <Button size="sm" onClick={() => setAttachOpen(true)}>
            Atrelar a campanha
          </Button>
        </div>
      )}

      {/* ── Tabela ── */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-20 text-center">
          <Users className="size-6 text-muted-foreground" />
          <p className="font-medium">Nenhum contato encontrado</p>
          <p className="text-sm text-muted-foreground">
            Ajuste os filtros para ver mais resultados.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={headerState}
                      onCheckedChange={toggleHeader}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="hidden md:table-cell">Tracking</TableHead>
                  <TableHead className="hidden lg:table-cell">Coluna</TableHead>
                  <TableHead className="hidden sm:table-cell">Temperatura</TableHead>
                  <TableHead className="hidden lg:table-cell">Responsável</TableHead>
                  <TableHead className="hidden md:table-cell">Criado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => {
                  const checked = allMatching || selectedIds.has(contact.id);
                  return (
                    <TableRow
                      key={contact.id}
                      data-state={checked ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => toggleRow(contact.id)}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={checked}
                          disabled={allMatching}
                          onCheckedChange={() => toggleRow(contact.id)}
                          aria-label={`Selecionar ${contact.name ?? contact.phone}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {contact.name || "Sem nome"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {contact.phone}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {contact.trackingName}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {contact.status ? (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: contact.status.color }}
                            />
                            {contact.status.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {contact.temperature ? (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                TEMP_DOT[contact.temperature],
                              )}
                            />
                            {TEMP_LABEL[contact.temperature]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {contact.responsible?.name ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {new Date(contact.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Por página</span>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[30, 40, 60].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="tabular-nums">{totalCount} contato(s)</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm tabular-nums text-muted-foreground">
                Página {page + 1} de {pageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={page === 0 || isFetching}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={page + 1 >= pageCount || isFetching}
                >
                  Próximo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AttachToCampaignDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        count={allMatching ? totalCount : selectedIds.size}
        buildInput={buildAttachInput}
        onDone={clearSelection}
      />
    </div>
  );
}
