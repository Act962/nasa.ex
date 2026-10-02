"use client";

import { useState } from "react";
import { useForgeProducts, useDeleteForgeProduct } from "../../hooks/use-forge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { ProductModal, type Product } from "./product-modal";
import { ProductList } from "./product-list";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

export function ProductsTab() {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useForgeProducts(search || undefined);
  const deleteProduct = useDeleteForgeProduct();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProduct.mutateAsync({ id: deleteId });
      toast.success("Produto removido");
    } catch {
      toast.error("Erro ao remover produto");
    } finally {
      setDeleteId(null);
    }
  };

  const handleEdit = (product: Product) => {
    setEditing(product);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 md:hidden">
        <Button
          className="h-11 w-full gap-1.5 rounded-full"
          onClick={handleAdd}
          data-guide={GUIDE_ANCHORS.forgeNewProductButton.id}
        >
          <Plus className="size-4" />
          Novo produto
        </Button>
        <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-1 backdrop-blur">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="h-11 rounded-full bg-muted pl-10"
              placeholder="Buscar por nome ou SKU..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 max-md:hidden">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button
          className="ml-auto gap-1.5"
          onClick={handleAdd}
          size="sm"
          data-guide={GUIDE_ANCHORS.forgeNewProductButton.id}
        >
          <Plus className="size-4" />
          Novo Produto
        </Button>
      </div>

      <ProductList
        isLoading={isLoading}
        products={data?.products ?? []}
        onEdit={handleEdit}
        onDelete={setDeleteId}
        onAdd={handleAdd}
      />

      <ProductModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        product={editing}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(isOpen) => !isOpen && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
