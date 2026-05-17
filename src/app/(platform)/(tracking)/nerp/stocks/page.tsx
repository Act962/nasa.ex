"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
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

const MOVEMENT_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ENTRADA: "default",
  COMPRA: "default",
  SAIDA: "secondary",
  VENDA: "secondary",
  DEVOLUCAO: "outline",
  AJUSTE: "outline",
  TRANSFERENCIA: "outline",
  PERDA: "destructive",
};

export default function NerpStocksPage() {
  // `name` é o único filtro textual aceito pelo nerp (busca por nome de
  // produto). Mantemos paginação default (offset/limit) — UI sem paginar.
  const [name, setName] = useState("");
  const query = useNerpStocks(name ? { name } : undefined);

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
          <div className="max-w-md">
            <Input
              placeholder="Buscar por nome do produto…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Antes → Depois</TableHead>
                    <TableHead>Por</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin inline mr-2" />
                        Carregando…
                      </TableCell>
                    </TableRow>
                  )}
                  {query.error && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-destructive">
                        {(query.error as Error).message}
                      </TableCell>
                    </TableRow>
                  )}
                  {query.data?.moviments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma movimentação encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {query.data?.moviments.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.product.name}</div>
                        {m.product.sku && (
                          <div className="text-xs text-muted-foreground">
                            SKU {m.product.sku}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={MOVEMENT_VARIANTS[m.type] ?? "outline"}>
                          {m.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {m.previousStock} → {m.newStock}
                      </TableCell>
                      <TableCell className="text-sm">{m.user.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString("pt-BR")}
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
