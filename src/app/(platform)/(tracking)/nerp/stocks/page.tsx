"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NerpShell } from "../../../../../features/nerp/components/nerp-shell";
import { NerpConnectionGuard } from "../../../../../features/nerp/components/connection-guard";
import { useNerpStocks } from "../../../../../features/nerp/hooks/use-nerp-stocks";

export default function NerpStocksPage() {
  const [productId, setProductId] = useState("");
  const query = useNerpStocks(productId ? { productId } : undefined);

  return (
    <NerpShell
      title="Estoque"
      description="Movimentações de estoque (entradas, saídas e ajustes) do nerp."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Atualizar
        </Button>
      }
    >
      <NerpConnectionGuard>
        <div className="space-y-4">
          <div className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar por productId…"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin inline mr-2" />
                        Carregando…
                      </TableCell>
                    </TableRow>
                  )}
                  {query.error && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-destructive">
                        {(query.error as Error).message}
                      </TableCell>
                    </TableRow>
                  )}
                  {query.data?.movements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma movimentação encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {query.data?.movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.productId}</TableCell>
                      <TableCell>
                        {m.type ? (
                          <Badge variant="outline">{m.type}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.reason ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.createdAt ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </NerpConnectionGuard>
    </NerpShell>
  );
}
