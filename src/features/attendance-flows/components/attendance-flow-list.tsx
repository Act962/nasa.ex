"use client";

// Lista de fluxos do FlowAstro (spec 0139): da empresa, cada um ligado aos números em que responde. Filtros e páginas
// ficam na tela: uma empresa tem dezenas de fluxos, não milhares.
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeftIcon, ChevronRightIcon, CopyIcon, MessagesSquareIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ATTENDANCE_ENTRY_LABELS, ATTENDANCE_ENTRY_MODES, type AttendanceEntry, type AttendanceEntryMode } from "../lib/entry-rules";
import { FLOW_TEMPLATES, type FlowTemplateKey } from "../lib/flow-templates";
import {
  useAttendanceFlows,
  useCreateAttendanceFlow,
  useDeleteAttendanceFlow,
  useDuplicateAttendanceFlow,
  useSetAttendanceFlowActive,
} from "../hooks/use-attendance-flows";

const PAGE_SIZES = [10, 25, 50] as const;
const ALL = "all";
const NO_NUMBER = "none";

const ENTRY_SHORT_LABELS: Record<AttendanceEntryMode, string> = {
  WELCOME: "Boas-vindas",
  KEYWORD: "Palavra-chave",
  DEFAULT: "Resposta padrão",
  BROADCAST: "Só por disparo",
};

type StatusFilter = "all" | "active" | "inactive";
type FlowRow = NonNullable<ReturnType<typeof useAttendanceFlows>["data"]>["flows"][number];

function EntryBadge({ entry }: { entry: AttendanceEntry }) {
  return (
    <span title={ATTENDANCE_ENTRY_LABELS[entry.mode]} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs">
      {ENTRY_SHORT_LABELS[entry.mode]}
      {entry.mode === "KEYWORD" && (
        <span className="max-w-40 truncate text-blue-600 dark:text-blue-300">{entry.keywords.length > 0 ? entry.keywords.join(", ") : "nenhuma"}</span>
      )}
    </span>
  );
}

function NumberChips({ numbers }: { numbers: FlowRow["numbers"] }) {
  if (numbers.length === 0) {
    return <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">Sem número</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {numbers.map((number) => (
        <span key={number.trackingId} className="rounded-md bg-muted px-2 py-0.5 text-xs">
          {number.name}
        </span>
      ))}
    </div>
  );
}

function SummaryCard({ value, label, tone }: { value: ReactNode; label: string; tone?: "warning" }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className={cn("text-2xl font-semibold tabular-nums", tone === "warning" && "text-amber-600 dark:text-amber-400")}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function CreateFlowDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void }) {
  const router = useRouter();
  const createFlow = useCreateAttendanceFlow();
  const [newName, setNewName] = useState("");
  const [templateKey, setTemplateKey] = useState<FlowTemplateKey>("blank");

  const handleCreate = () => {
    createFlow.mutate(
      { name: newName.trim(), template: templateKey },
      {
        onSuccess: (created) => router.push(`/flowastro/${created.id}`),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo fluxo</DialogTitle>
        </DialogHeader>
        <Input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ex.: Boas-vindas da pizzaria" onKeyDown={(event) => event.key === "Enter" && newName.trim() && handleCreate()} />
        <div className="space-y-2">
          <p className="text-sm font-medium">Começar com</p>
          {FLOW_TEMPLATES.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => setTemplateKey(template.key)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted",
                templateKey === template.key ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10" : "border-border",
              )}
            >
              <span className="block text-sm font-medium">{template.label}</span>
              <span className="block text-xs text-muted-foreground">{template.description}</span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!newName.trim() || createFlow.isPending} onClick={handleCreate}>
            Criar e montar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttendanceFlowList() {
  const router = useRouter();
  const { data, isLoading } = useAttendanceFlows();
  const duplicateFlow = useDuplicateAttendanceFlow();
  const setActive = useSetAttendanceFlowActive();
  const deleteFlow = useDeleteAttendanceFlow();
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [numberFilter, setNumberFilter] = useState<string>(ALL);
  const [entryFilter, setEntryFilter] = useState<string>(ALL);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const flows = useMemo(() => data?.flows ?? [], [data?.flows]);

  const numberOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const flow of flows) for (const number of flow.numbers) byId.set(number.trackingId, number.name);
    return [...byId].map(([trackingId, name]) => ({ trackingId, name })).sort((first, second) => first.name.localeCompare(second.name));
  }, [flows]);

  const filteredFlows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return flows.filter((flow) => {
      if (term && !flow.name.toLocaleLowerCase("pt-BR").includes(term)) return false;
      if (statusFilter === "active" && !flow.isActive) return false;
      if (statusFilter === "inactive" && flow.isActive) return false;
      if (numberFilter === NO_NUMBER && flow.numbers.length > 0) return false;
      if (numberFilter !== ALL && numberFilter !== NO_NUMBER && !flow.numbers.some((number) => number.trackingId === numberFilter)) return false;
      if (entryFilter !== ALL && flow.entry.mode !== entryFilter) return false;
      return true;
    });
  }, [flows, search, statusFilter, numberFilter, entryFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredFlows.length / pageSize));
  // Filtro novo pode encolher a lista: a página nunca passa da última.
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * pageSize;
  const pageFlows = filteredFlows.slice(firstIndex, firstIndex + pageSize);
  const hasFilters = search.trim() !== "" || statusFilter !== "all" || numberFilter !== ALL || entryFilter !== ALL;

  const activeCount = flows.filter((flow) => flow.isActive).length;
  const leadsInside = flows.reduce((total, flow) => total + flow.leadsInside, 0);
  const withoutNumber = flows.filter((flow) => flow.numbers.length === 0).length;

  const updateFilter = <TValue,>(setter: (value: TValue) => void) => (value: TValue) => {
    setter(value);
    setPage(1);
  };
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setNumberFilter(ALL);
    setEntryFilter(ALL);
    setPage(1);
  };

  const duplicate = (flow: FlowRow) =>
    duplicateFlow.mutate({ workflowId: flow.id }, { onSuccess: () => toast.success("Fluxo duplicado"), onError: (error) => toast.error(error.message) });
  const remove = (flow: FlowRow) => {
    if (!window.confirm(`Apagar o fluxo "${flow.name}"? Leads dentro dele saem do fluxo.`)) return;
    deleteFlow.mutate({ id: flow.id }, { onSuccess: () => toast.success("Fluxo apagado"), onError: (error) => toast.error(error.message) });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">FlowAstro</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Fluxos de atendimento do WhatsApp. Um fluxo ligado responde primeiro nos números escolhidos; a IA só entra onde houver o bloco &quot;Agente de IA&quot;.
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700">
          <PlusIcon className="size-4" /> Novo fluxo
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && flows.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
          <MessagesSquareIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">Nenhum fluxo ainda</p>
          <p className="max-w-md text-sm text-muted-foreground">Monte o caminho do cliente desde a primeira mensagem e escolha em quais números ele responde.</p>
        </div>
      )}

      {flows.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard
              value={
                <>
                  {activeCount} <span className="text-sm font-normal text-muted-foreground">de {flows.length}</span>
                </>
              }
              label="Fluxos ligados"
            />
            <SummaryCard value={leadsInside} label="Clientes dentro de um fluxo agora" />
            <SummaryCard value={withoutNumber} label="Fluxos sem número (não respondem)" tone={withoutNumber > 0 ? "warning" : undefined} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => updateFilter(setSearch)(event.target.value)} placeholder="Buscar fluxo pelo nome" className="pl-9" />
            </div>
            <div className="flex rounded-lg border border-border bg-card p-0.5">
              {(
                [
                  { value: "all", label: "Todos" },
                  { value: "active", label: "Ligados" },
                  { value: "inactive", label: "Desligados" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateFilter(setStatusFilter)(option.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    statusFilter === option.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Select value={numberFilter} onValueChange={updateFilter(setNumberFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os números</SelectItem>
                {numberOptions.map((number) => (
                  <SelectItem key={number.trackingId} value={number.trackingId}>
                    {number.name}
                  </SelectItem>
                ))}
                <SelectItem value={NO_NUMBER}>Sem número</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entryFilter} onValueChange={updateFilter(setEntryFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as entradas</SelectItem>
                {ATTENDANCE_ENTRY_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {ENTRY_SHORT_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data?.isTruncated && (
            <p className="text-xs text-muted-foreground">Mostrando os {flows.length} fluxos editados mais recentemente.</p>
          )}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Fluxo</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Entrada</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Números</th>
                  <th className="px-4 py-2.5 font-medium">No fluxo agora</th>
                  <th className="px-4 py-2.5 font-medium">Ligado</th>
                  <th className="w-12 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageFlows.map((flow) => (
                  <tr key={flow.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => router.push(`/flowastro/${flow.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{flow.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Editado {formatDistanceToNow(new Date(flow.updatedAt), { addSuffix: true, locale: ptBR })} · {flow.blockCount} {flow.blockCount === 1 ? "bloco" : "blocos"}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <EntryBadge entry={flow.entry} />
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <NumberChips numbers={flow.numbers} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {flow.leadsInside > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-green-500" />
                          {flow.leadsInside}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <Switch
                        checked={flow.isActive}
                        disabled={setActive.isPending}
                        onCheckedChange={(isActive) =>
                          setActive.mutate({ workflowId: flow.id, isActive, ignoreCollisions: true }, { onError: (error) => toast.error(error.message) })
                        }
                      />
                    </td>
                    <td className="px-2 py-3" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Ações do fluxo ${flow.name}`}>
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/flowastro/${flow.id}`)}>
                            <PencilIcon className="size-4" /> Abrir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicate(flow)}>
                            <CopyIcon className="size-4" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => remove(flow)}>
                            <Trash2Icon className="size-4" /> Apagar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {pageFlows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Nenhum fluxo com esses filtros.{" "}
                      {hasFilters && (
                        <button type="button" onClick={clearFilters} className="font-medium text-foreground underline-offset-4 hover:underline">
                          Limpar filtros
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                {filteredFlows.length === 0 ? 0 : firstIndex + 1}–{Math.min(firstIndex + pageSize, filteredFlows.length)} de {filteredFlows.length}{" "}
                {filteredFlows.length === 1 ? "fluxo" : "fluxos"}
              </span>
              <div className="flex items-center gap-2">
                <span>Por página</span>
                <Select value={String(pageSize)} onValueChange={(value) => updateFilter(setPageSize)(Number(value))}>
                  <SelectTrigger size="sm" className="w-18">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="size-8" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Página anterior">
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <span className="tabular-nums">
                  {currentPage} de {pageCount}
                </span>
                <Button variant="outline" size="icon" className="size-8" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Próxima página">
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <CreateFlowDialog isOpen={isCreating} onOpenChange={setIsCreating} />
    </div>
  );
}
