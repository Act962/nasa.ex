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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          className="ml-auto bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
          onClick={handleAdd}
          size="sm"
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
        onOpenChange={(o) => !o && setDeleteId(null)}
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
