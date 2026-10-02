"use client";

import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  type StarFriendsHistoryFilters,
  useExportStarFriendsHistory,
  useStarFriendsHistory,
} from "../hooks/use-star-friends";
import { ACTOR_TYPE_LABELS, LEDGER_TYPE_LABELS, describeSnapshot, formatStars } from "../utils/labels";

const ALL_VALUE = "__all__";
const EMPTY_HISTORY_MESSAGE = "Nenhuma movimentação com esses filtros.";

function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

interface HistoryAuditProps {
  filters: StarFriendsHistoryFilters;
  onFiltersChange: (filters: StarFriendsHistoryFilters) => void;
}

export function HistoryAudit({ filters, onFiltersChange }: HistoryAuditProps) {
  const history = useStarFriendsHistory(filters);
  const exportHistory = useExportStarFriendsHistory();
  const entries = history.data?.pages.flatMap((page) => page.entries) ?? [];
  const actors = history.data?.pages[0]?.actors ?? [];

  const handleExport = () =>
    exportHistory.mutate(filters, {
      onSuccess: (result) => {
        const header = ["Data", "Cliente", "Telefone", "Tipo", "Stars", "Quem", "Tipo de autor", "Itens / motivo"];
        const lines = result.entries.map((entry) =>
          [
            format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm:ss"),
            entry.member.name,
            entry.member.phone,
            LEDGER_TYPE_LABELS[entry.type],
            String(entry.stars),
            entry.actorName,
            ACTOR_TYPE_LABELS[entry.actorType],
            entry.reason ?? describeSnapshot(entry.itemsSnapshot),
          ]
            .map(toCsvCell)
            .join(";"),
        );
        const blob = new Blob([[header.map(toCsvCell).join(";"), ...lines].join("\n")], {
          type: "text/csv;charset=utf-8",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `star-friends-historico-${format(new Date(), "yyyy-MM-dd")}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      },
      onError: (error) => toast.error(error.message),
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-end">
        <Select
          value={filters.actorUserId ?? ALL_VALUE}
          onValueChange={(value) => onFiltersChange({ ...filters, actorUserId: value === ALL_VALUE ? undefined : value })}
        >
          <SelectTrigger className="col-span-2 h-11 w-full rounded-full md:h-9 md:w-52">
            <SelectValue placeholder="Usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos os usuários</SelectItem>
            {actors.map((actor) => (
              <SelectItem key={actor.userId} value={actor.userId}>
                {actor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.type ?? ALL_VALUE}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              type: value === ALL_VALUE ? undefined : (value as StarFriendsHistoryFilters["type"]),
            })
          }
        >
          <SelectTrigger className="col-span-2 h-11 w-full rounded-full md:h-9 md:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos os tipos</SelectItem>
            {Object.entries(LEDGER_TYPE_LABELS).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          aria-label="Data inicial"
          className="h-11 w-full rounded-full md:h-9 md:w-40"
          onChange={(event) =>
            onFiltersChange({ ...filters, from: event.target.value ? new Date(`${event.target.value}T00:00:00`).toISOString() : undefined })
          }
        />
        <Input
          type="date"
          aria-label="Data final"
          className="h-11 w-full rounded-full md:h-9 md:w-40"
          onChange={(event) =>
            onFiltersChange({ ...filters, to: event.target.value ? new Date(`${event.target.value}T23:59:59`).toISOString() : undefined })
          }
        />
        {filters.memberId && (
          <Button
            variant="ghost"
            className="col-span-2 h-11 rounded-full md:h-9"
            onClick={() => onFiltersChange({ ...filters, memberId: undefined })}
          >
            <X className="size-4" /> Limpar cliente
          </Button>
        )}
        <Button
          variant="outline"
          className="col-span-2 h-11 rounded-full md:ml-auto md:h-9"
          disabled={exportHistory.isPending}
          onClick={handleExport}
        >
          {exportHistory.isPending ? <OrbitaSpinner className="size-4" /> : <Download className="size-4" />} Exportar CSV
        </Button>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {entries.map((entry) => {
          const isCredit = entry.stars > 0;
          return (
            <div key={entry.id} className="flex flex-col gap-2 rounded-[20px] border border-line bg-card p-3">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted",
                    isCredit ? "text-success" : "text-destructive",
                  )}
                >
                  {isCredit ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                      {LEDGER_TYPE_LABELS[entry.type]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-medium">{entry.member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{entry.member.phone}</p>
                </div>
                <span className={cn("shrink-0 text-lg font-bold", isCredit ? "text-success" : "text-destructive")}>
                  {formatStars(entry.stars)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{entry.reason ?? describeSnapshot(entry.itemsSnapshot)}</p>
              <p className="text-xs text-muted-foreground">
                {ACTOR_TYPE_LABELS[entry.actorType]}: {entry.actorName}
              </p>
            </div>
          );
        })}
        {entries.length === 0 && !history.isLoading && (
          <p className="rounded-[20px] border border-line bg-card p-4 text-center text-sm text-muted-foreground">
            {EMPTY_HISTORY_MESSAGE}
          </p>
        )}
      </div>

      {history.isLoading && (
        <div className="flex justify-center py-6">
          <OrbitaSpinner className="size-5 text-muted-foreground" />
        </div>
      )}

      <div className="max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data e hora</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Movimento</TableHead>
              <TableHead className="text-right">Stars</TableHead>
              <TableHead>Quem</TableHead>
              <TableHead>Itens / motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap">{format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm:ss")}</TableCell>
                <TableCell>
                  <p className="font-medium">{entry.member.name}</p>
                  <p className="text-xs text-muted-foreground">{entry.member.phone}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{LEDGER_TYPE_LABELS[entry.type]}</Badge>
                </TableCell>
                <TableCell className={entry.stars > 0 ? "text-right font-semibold text-success" : "text-right font-semibold text-destructive"}>
                  {formatStars(entry.stars)}
                </TableCell>
                <TableCell>
                  <p>{entry.actorName}</p>
                  <p className="text-xs text-muted-foreground">{ACTOR_TYPE_LABELS[entry.actorType]}</p>
                </TableCell>
                <TableCell className="max-w-md text-sm text-muted-foreground">
                  {entry.reason ?? describeSnapshot(entry.itemsSnapshot)}
                </TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && !history.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {EMPTY_HISTORY_MESSAGE}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {history.hasNextPage && (
        <Button
          variant="outline"
          className="h-11 w-full rounded-full md:w-fit"
          disabled={history.isFetchingNextPage}
          onClick={() => history.fetchNextPage()}
        >
          Carregar mais
        </Button>
      )}
    </div>
  );
}
