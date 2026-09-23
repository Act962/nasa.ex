"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Pencil, Plus, Power } from "lucide-react";
import { sourceUrlFor } from "@/features/forge/lib/recommendation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useForgePriceItems,
  useDeleteForgePriceItem,
} from "@/features/forge/hooks/use-forge-price-catalog";
import { PriceItemModal, type PriceItemForForm } from "./price-item-modal";

export function PriceCatalogManager() {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PriceItemForForm | null>(null);
  const { data, isLoading } = useForgePriceItems({ search: search || undefined });
  const deleteMutation = useDeleteForgePriceItem();

  const items = (data?.items ?? []) as unknown as (PriceItemForForm & {
    isActive: boolean;
    isSeeded: boolean;
  })[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Buscar por nome, código ou provedor"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 max-w-sm"
        />
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="bg-[#7C3AED] hover:bg-[#6D28D9]"
        >
          <Plus className="mr-1 size-4" /> Novo item
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Provedor</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id} className={item.isActive ? "" : "opacity-50"}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {item.name}
                    {(() => {
                      const url = sourceUrlFor(item);
                      return url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          title="Ver fonte do preço"
                          className="text-muted-foreground hover:text-[#7C3AED]"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : null;
                    })()}
                  </span>
                  {item.isSeeded && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      seed
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs">{item.category}</TableCell>
                <TableCell className="text-xs">{item.provider ?? "—"}</TableCell>
                <TableCell className="text-xs">{item.unit}</TableCell>
                <TableCell className="text-right text-xs">
                  {item.category === "AI_MODEL"
                    ? `${item.inputPer1k ?? "—"} / ${item.outputPer1k ?? "—"} ${item.currency}/1k`
                    : `${item.unitPrice ?? "—"} ${item.currency}`}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => {
                        setEditing(item);
                        setModalOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Desativar"
                      onClick={() => deleteMutation.mutate({ id: item.id })}
                    >
                      <Power className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PriceItemModal open={modalOpen} onOpenChange={setModalOpen} item={editing} />
    </div>
  );
}
