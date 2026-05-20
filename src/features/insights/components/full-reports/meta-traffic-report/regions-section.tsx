"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapPinIcon } from "lucide-react";

/**
 * Tabela de regiões com maior alcance no período.
 *
 * Usa breakdown=region da Meta Marketing API. Mostra top 10 por reach com
 * impressões, frequência, investimento e CPM. Quando não houver dados,
 * renderiza estado vazio sem quebrar.
 */
interface Props {
  from: Date;
  to: Date;
  limit?: number;
}

const fmtInt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
const fmtDecimal = (v: number, d = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);

export function RegionsSection({ from, to, limit = 10 }: Props) {
  const { data, isLoading } = useQuery(
    orpc.metaAds.insightsBreakdown.queryOptions({
      input: {
        breakdown: "region",
        startDate: from.toISOString(),
        endDate: to.toISOString(),
      },
    }),
  );

  // API retorna ordenado por spend desc, mas pra "regiões com maior alcance"
  // preferimos reach desc. Reordena antes de cortar pelo limit.
  const rows = useMemo(() => {
    const r = [...(data?.rows ?? [])];
    r.sort((a, b) => b.reach - a.reach);
    return r.slice(0, limit);
  }, [data, limit]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 p-6 text-center">
          <MapPinIcon className="size-5 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">
            Sem dados de regiões no período. Verifique se a campanha tem
            entrega geográfica suficiente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-[10px] uppercase tracking-wide">
                <TableHead>Região</TableHead>
                <TableHead className="text-right">Alcance</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="text-right">Frequência</TableHead>
                <TableHead className="text-right">Investido</TableHead>
                <TableHead className="text-right">CPM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.segment} className="text-xs">
                  <TableCell className="font-medium">{r.segment}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtInt(r.reach)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtInt(r.impressions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtDecimal(r.frequency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtCurrency(r.spend)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.cpm > 0 ? fmtCurrency(r.cpm) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
