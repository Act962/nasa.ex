"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Copy, RefreshCw, Search } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NerpShell } from "../../../../../features/nerp/components/nerp-shell";
import { NerpConnectionGuard } from "../../../../../features/nerp/components/connection-guard";
import { DeleteButton } from "../../../../../features/nerp/components/delete-button";
import {
  useNerpProducts,
  useCreateNerpProduct,
  useUpdateNerpProduct,
  useDuplicateNerpProduct,
  useDeleteNerpProduct,
} from "../../../../../features/nerp/hooks/use-nerp-products";
import { useNerpCategories } from "../../../../../features/nerp/hooks/use-nerp-categories";

const NO_CATEGORY_VALUE = "__none__";

// Espelha o input do nerp em `products.create`: name/costPrice/salePrice
// são obrigatórios; o resto é opcional.
const formSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  costPrice: z.coerce.number().nonnegative("Custo inválido"),
  salePrice: z.coerce.number().nonnegative("Preço inválido"),
  currentStock: z.coerce.number().nonnegative().optional(),
  categoryId: z.string().optional(),
  thumbnail: z.string().url("URL inválida").optional().or(z.literal("")),
});
type FormValues = z.infer<typeof formSchema>;

function ProductFormDialog({
  trigger,
  initialValues,
  onSubmit,
  isPending,
  title,
}: {
  trigger: React.ReactNode;
  initialValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void> | void;
  isPending?: boolean;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  // Carrega categorias só quando o dialog abre — evita hit no nerp na lista.
  const categoriesQuery = useNerpCategories();
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: initialValues?.name ?? "",
      sku: initialValues?.sku ?? "",
      barcode: initialValues?.barcode ?? "",
      description: initialValues?.description ?? "",
      costPrice: initialValues?.costPrice ?? 0,
      salePrice: initialValues?.salePrice ?? 0,
      currentStock: initialValues?.currentStock,
      categoryId: initialValues?.categoryId ?? "",
      thumbnail: initialValues?.thumbnail ?? "",
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Dados enviados ao nerp via integração.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (v) => {
              await onSubmit(v);
              setOpen(false);
              form.reset();
            })}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Camiseta NASA Apollo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: NASA-CAM-001" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código de barras</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: 7891234567890" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select
                      // O componente Select não aceita `""` como value; usamos
                      // sentinela e convertemos pra string vazia no form.
                      value={field.value ? field.value : NO_CATEGORY_VALUE}
                      onValueChange={(v) =>
                        field.onChange(v === NO_CATEGORY_VALUE ? "" : v)
                      }
                      disabled={categoriesQuery.isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              categoriesQuery.isLoading
                                ? "Carregando…"
                                : "Selecionar categoria"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY_VALUE}>
                          Sem categoria
                        </SelectItem>
                        {categoriesQuery.data?.categories.map((cat) => (
                          <SelectGroup key={cat.id}>
                            <SelectItem value={cat.id}>{cat.name}</SelectItem>
                            {cat.children.length > 0 && (
                              <SelectLabel className="pl-6 text-[11px] text-muted-foreground">
                                Subcategorias
                              </SelectLabel>
                            )}
                            {cat.children.map((child) => (
                              <SelectItem
                                key={child.id}
                                value={child.id}
                                className="pl-8"
                              >
                                ↳ {child.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                        {categoriesQuery.data &&
                          categoriesQuery.data.categories.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              Nenhuma categoria no nerp.
                            </div>
                          )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço de venda</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque inicial</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.001"
                        placeholder="Ex: 50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="thumbnail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imagem (URL)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://exemplo.com/imagem.jpg"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="Breve descrição que vai aparecer no catálogo"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const PAGE_SIZE = 20;

function formatBRL(n?: number | null) {
  return typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
}

export default function NerpProductsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useNerpProducts({
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const create = useCreateNerpProduct();
  const update = useUpdateNerpProduct();
  const duplicate = useDuplicateNerpProduct();
  const remove = useDeleteNerpProduct();

  return (
    <NerpShell
      title="Produtos"
      description="Catálogo de produtos do nerp."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </Button>
          <ProductFormDialog
            title="Novo produto"
            isPending={create.isPending}
            onSubmit={async (v) => {
              await create.mutateAsync(
                {
                  name: v.name,
                  sku: v.sku || undefined,
                  barcode: v.barcode || undefined,
                  description: v.description || undefined,
                  costPrice: v.costPrice,
                  salePrice: v.salePrice,
                  currentStock: v.currentStock,
                  categoryId: v.categoryId || undefined,
                  thumbnail: v.thumbnail || undefined,
                },
                {
                  onSuccess: () => toast.success("Produto criado"),
                  onError: (err: { message?: string }) =>
                    toast.error(err?.message ?? "Falhou"),
                },
              );
            }}
            trigger={
              <Button size="sm">
                <Plus className="size-3.5" /> Novo produto
              </Button>
            }
          />
        </div>
      }
    >
      <NerpConnectionGuard>
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar produto…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin inline mr-2" /> Carregando…
                      </TableCell>
                    </TableRow>
                  )}
                  {query.data?.products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum produto encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {query.data?.products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image}
                            alt=""
                            className="size-8 rounded border object-cover"
                          />
                        ) : (
                          <div className="size-8 rounded border bg-muted" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.category && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {p.category}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.sku || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(p.salePrice)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.currentStock ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.isActive === false ? "secondary" : "default"}>
                          {p.isActive === false ? "Inativo" : "Ativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <ProductFormDialog
                            title="Editar produto"
                            initialValues={{
                              name: p.name,
                              sku: p.sku || "",
                              barcode: p.barcode || "",
                              costPrice: p.costPrice,
                              salePrice: p.salePrice,
                              currentStock: p.currentStock,
                              thumbnail: p.image || "",
                            }}
                            isPending={update.isPending}
                            onSubmit={async (v) => {
                              await update.mutateAsync(
                                {
                                  id: p.id,
                                  name: v.name,
                                  sku: v.sku || undefined,
                                  barcode: v.barcode || undefined,
                                  description: v.description || undefined,
                                  costPrice: v.costPrice,
                                  salePrice: v.salePrice,
                                  currentStock: v.currentStock,
                                  categoryId: v.categoryId || undefined,
                                  thumbnail: v.thumbnail || undefined,
                                },
                                {
                                  onSuccess: () => toast.success("Produto atualizado"),
                                  onError: (err: { message?: string }) =>
                                    toast.error(err?.message ?? "Falhou"),
                                },
                              );
                            }}
                            trigger={
                              <Button variant="ghost" size="icon">
                                <Pencil className="size-3.5" />
                              </Button>
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              duplicate.mutate(
                                { productId: p.id },
                                {
                                  onSuccess: () => toast.success("Produto duplicado"),
                                  onError: (err: { message?: string }) =>
                                    toast.error(err?.message ?? "Falhou"),
                                },
                              )
                            }
                            disabled={duplicate.isPending}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <DeleteButton
                            title="Remover produto?"
                            description={`O produto "${p.name}" será deletado do nerp.`}
                            isPending={remove.isPending}
                            onConfirm={() =>
                              remove.mutate(
                                { productId: p.id },
                                {
                                  onSuccess: () => toast.success("Produto removido"),
                                  onError: (err: { message?: string }) =>
                                    toast.error(err?.message ?? "Falhou"),
                                },
                              )
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {query.data && (query.data.totalPages ?? 1) > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => query.data?.hasPreviousPage && setPage((p) => p - 1)}
                    aria-disabled={!query.data?.hasPreviousPage}
                    className={!query.data?.hasPreviousPage ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink isActive>
                    {query.data.page ?? page} / {query.data.totalPages}
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => query.data?.hasNextPage && setPage((p) => p + 1)}
                    aria-disabled={!query.data?.hasNextPage}
                    className={!query.data?.hasNextPage ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </NerpConnectionGuard>
    </NerpShell>
  );
}
