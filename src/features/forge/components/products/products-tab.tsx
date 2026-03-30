"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useForgeProducts,
  useCreateForgeProduct,
  useUpdateForgeProduct,
  useDeleteForgeProduct,
} from "../../hooks/use-forge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const UNITS = ["un", "hr", "dia", "mês", "km", "kg", "L", "outro"];

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  sku: z.string().min(1, "SKU obrigatório"),
  unit: z.string().default("un"),
  description: z.string().optional(),
  value: z.string().min(1, "Valor obrigatório"),
  imageUrl: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  description: string | null;
  value: string;
  imageUrl: string | null;
}

function ProductImageUploader({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <Uploader
      value={value || undefined}
      fileTypeAccepted="image"
      onConfirm={onChange}
    />
  );
}

function ProductModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}) {
  const create = useCreateForgeProduct();
  const update = useUpdateForgeProduct();
  const [imageKey, setImageKey] = useState<string>(product?.imageUrl ?? "");

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      unit: product?.unit ?? "un",
      description: product?.description ?? "",
      value: product?.value ?? "",
      imageUrl: product?.imageUrl ?? "",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const payload = { ...data, imageUrl: imageKey || undefined };
      if (product) {
        await update.mutateAsync({ id: product.id, ...payload });
        toast.success("Produto atualizado");
      } else {
        await create.mutateAsync(payload);
        toast.success("Produto criado");
      }
      onClose();
    } catch {
      toast.error("Erro ao salvar produto");
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input {...form.register("name")} placeholder="Ex: Gestão de Social Media" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>SKU *</Label>
              <Input {...form.register("sku")} placeholder="Ex: SMS-001" />
              {form.formState.errors.sku && (
                <p className="text-xs text-destructive">{form.formState.errors.sku.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Unidade *</Label>
              <Select
                defaultValue={form.getValues("unit")}
                onValueChange={(v) => form.setValue("unit", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor *</Label>
              <Input
                {...form.register("value")}
                placeholder="0,00"
                type="number"
                step="0.01"
                min="0"
              />
              {form.formState.errors.value && (
                <p className="text-xs text-destructive">{form.formState.errors.value.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Imagem do Produto</Label>
            <ProductImageUploader
              value={imageKey}
              onChange={(key) => setImageKey(key)}
            />
            <p className="text-[11px] text-muted-foreground">Arraste ou clique para enviar. Máximo 5MB.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea {...form.register("description")} placeholder="Descreva o produto ou serviço..." rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
              {isPending ? "Salvando..." : "Salvar Produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductImage({ imageKey }: { imageKey: string | null }) {
  const url = useConstructUrl(imageKey ?? "");
  if (!imageKey) {
    return (
      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
        <Package className="size-3.5 text-muted-foreground" />
      </div>
    );
  }
  return <img src={url} alt="" className="w-8 h-8 rounded object-cover border" />;
}

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
          onClick={() => { setEditing(null); setModalOpen(true); }}
        >
          <Plus className="size-4" />
          Novo Produto
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !data?.products.length ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <Package className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
          <Button variant="outline" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="size-4 mr-1.5" /> Adicionar produto
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <TooltipProvider delayDuration={300}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="min-w-[200px]">Produto</TableHead>
                  <TableHead className="w-[110px] hidden sm:table-cell">SKU</TableHead>
                  <TableHead className="w-[80px] hidden md:table-cell">Unidade</TableHead>
                  <TableHead className="text-right w-[120px]">Valor</TableHead>
                  <TableHead className="text-right w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-0">
                      <div className="flex items-start gap-2.5">
                        <div className="shrink-0 mt-0.5">
                          <ProductImage imageKey={p.imageUrl} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          {p.description && (
                            <>
                              {/* Short screens: show 1 line */}
                              <p className="text-xs text-muted-foreground line-clamp-1 sm:hidden">
                                {p.description}
                              </p>
                              {/* Medium screens: show 2 lines with tooltip for full text */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-xs text-muted-foreground line-clamp-2 hidden sm:block cursor-default">
                                    {p.description}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-wrap">
                                  {p.description}
                                </TooltipContent>
                              </Tooltip>
                            </>
                          )}
                          {/* SKU inline on small screens */}
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5 sm:hidden">{p.sku}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs hidden sm:table-cell">{p.sku}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell">{p.unit}</TableCell>
                    <TableCell className="text-right text-sm font-semibold whitespace-nowrap">
                      {Number(p.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => { setEditing(p); setModalOpen(true); }}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      )}

      <ProductModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        product={editing}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
