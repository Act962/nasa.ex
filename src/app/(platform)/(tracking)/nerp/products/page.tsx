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

const formSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  sku: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().nonnegative().optional(),
  cost: z.coerce.number().nonnegative().optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
  categoryId: z.string().optional(),
  imageUrl: z.string().url("URL inválida").optional().or(z.literal("")),
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
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: initialValues?.name ?? "",
      sku: initialValues?.sku ?? "",
      description: initialValues?.description ?? "",
      price: initialValues?.price,
      cost: initialValues?.cost,
      stock: initialValues?.stock,
      categoryId: initialValues?.categoryId ?? "",
      imageUrl: initialValues?.imageUrl ?? "",
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
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria (ID)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.01" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.01" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque inicial</FormLabel>
                    <FormControl><Input {...field} type="number" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imagem (URL)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormControl><Textarea {...field} rows={3} /></FormControl>
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
                  description: v.description || undefined,
                  price: v.price,
                  cost: v.cost,
                  stock: v.stock,
                  categoryId: v.categoryId || undefined,
                  imageUrl: v.imageUrl || undefined,
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
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="size-8 rounded border object-cover"
                          />
                        ) : (
                          <div className="size-8 rounded border bg-muted" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {p.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.sku ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(p.price)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.stock ?? "—"}</TableCell>
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
                              sku: p.sku ?? "",
                              description: p.description ?? "",
                              price: p.price ?? undefined,
                              cost: p.cost ?? undefined,
                              stock: p.stock ?? undefined,
                              categoryId: p.categoryId ?? "",
                              imageUrl: p.imageUrl ?? "",
                            }}
                            isPending={update.isPending}
                            onSubmit={async (v) => {
                              await update.mutateAsync(
                                {
                                  id: p.id,
                                  name: v.name,
                                  sku: v.sku || undefined,
                                  description: v.description || undefined,
                                  price: v.price,
                                  cost: v.cost,
                                  stock: v.stock,
                                  categoryId: v.categoryId || undefined,
                                  imageUrl: v.imageUrl || undefined,
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
                                { id: p.id },
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
                                { id: p.id },
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
