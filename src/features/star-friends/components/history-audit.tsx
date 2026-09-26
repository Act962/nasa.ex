"use client";

import { format } from "date-fns";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <div className="flex flex-wrap items-end gap-2">
        <Select
          value={filters.actorUserId ?? ALL_VALUE}
          onValueChange={(value) => onFiltersChange({ ...filters, actorUserId: value === ALL_VALUE ? undefined : value })}
        >
          <SelectTrigger className="w-52">
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
          <SelectTrigger className="w-44">
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
          className="w-40"
          onChange={(event) =>
            onFiltersChange({ ...filters, from: event.target.value ? new Date(`${event.target.value}T00:00:00`).toISOString() : undefined })
          }
        />
        <Input
          type="date"
          className="w-40"
          onChange={(event) =>
            onFiltersChange({ ...filters, to: event.target.value ? new Date(`${event.target.value}T23:59:59`).toISOString() : undefined })
          }
        />
        {filters.memberId && (
          <Button variant="ghost" onClick={() => onFiltersChange({ ...filters, memberId: undefined })}>
            Limpar cliente
          </Button>
        )}
        <Button variant="outline" className="ml-auto" disabled={exportHistory.isPending} onClick={handleExport}>
          <Download className="size-4" /> Exportar CSV
        </Button>
      </div>
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
              <TableCell className={entry.stars > 0 ? "text-right font-semibold text-emerald-600" : "text-right font-semibold text-red-500"}>
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
                Nenhuma movimentação com esses filtros.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {history.hasNextPage && (
        <Button variant="outline" className="w-fit" onClick={() => history.fetchNextPage()}>
          Carregar mais
        </Button>
      )}
    </div>
  );
}
