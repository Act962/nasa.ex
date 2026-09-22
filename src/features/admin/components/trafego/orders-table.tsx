"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TrafegoOrderStatus, TrafegoPlatform } from "@/generated/prisma/enums";
import { useTrafegoAdminOrders } from "@/features/trafego/hooks/use-trafego-admin";
import { ORDER_STATUS_LABEL } from "@/features/trafego/lib/order-status";
import { PLATFORM_SHORT_LABEL } from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { OrderStatusBadge } from "@/features/trafego/components/panel/order-status-badge";
import { useAdminPath } from "@/features/trafego/lib/base-path";

const ALL = "__all__";

export function TrafegoOrdersTable() {
  const [status, setStatus] = useState<string>(ALL);
  const [platform, setPlatform] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const adminPath = useAdminPath();

  const { data, isLoading } = useTrafegoAdminOrders({
    status: status === ALL ? undefined : (status as TrafegoOrderStatus),
    platform: platform === ALL ? undefined : (platform as TrafegoPlatform),
    search: search.trim() || undefined,
    page,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">trafeGO — pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Fila de campanhas contratadas pelos clientes.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`${adminPath}/settings`}>
            <Settings2 className="mr-1.5 size-4" />
            Ajustes
          </Link>
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Buscar por código, empresa ou e-mail"
          className="max-w-xs"
        />

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={platform}
          onValueChange={(value) => {
            setPlatform(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os canais</SelectItem>
            {Object.entries(PLATFORM_SHORT_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Materiais</TableHead>
              <TableHead>Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}

            {!isLoading && data?.orders.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum pedido encontrado com esses filtros.
                </TableCell>
              </TableRow>
            )}

            {data?.orders.map((order) => (
              <TableRow
                key={order.id}
                className="cursor-pointer"
                onClick={() => {
                  window.location.href = `${adminPath}/${order.id}`;
                }}
              >
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs">{order.code}</span>
                    {order.amountMismatch && (
                      <AlertTriangle
                        className="size-3.5 text-amber-500"
                        aria-label="Valor cobrado divergente"
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.planNameSnapshot}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-sm">
                    {order.businessName ?? order.organization.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{order.owner.email}</p>
                </TableCell>
                <TableCell className="text-sm">
                  {PLATFORM_SHORT_LABEL[order.platform]}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatBrlFromCents(order.totalBrlCents)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {order.creativesCount} criativos · {order.copiesCount} copies
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(order.createdAt), "dd MMM", { locale: ptBR })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {data.total} pedidos · página {page} de {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
