"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, RefreshCw } from "lucide-react";
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
import { NerpShell } from "../../../../../features/nerp/components/nerp-shell";
import { NerpConnectionGuard } from "../../../../../features/nerp/components/connection-guard";
import { DeleteButton } from "../../../../../features/nerp/components/delete-button";
import {
  useNerpCategories,
  useCreateNerpCategory,
  useUpdateNerpCategory,
  useDeleteNerpCategory,
} from "../../../../../features/nerp/hooks/use-nerp-categories";

const formSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional(),
  parentId: z.string().optional(),
  isActive: z.boolean().optional(),
});
type FormValues = z.infer<typeof formSchema>;

type Category = { id: string; name: string; slug?: string | null; description?: string | null; parentId?: string | null; isActive?: boolean; productsCount?: number };

function CategoryFormDialog({
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
      description: initialValues?.description ?? "",
      parentId: initialValues?.parentId ?? "",
      isActive: initialValues?.isActive ?? true,
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Os dados serão enviados ao nerp via integração.
          </DialogDescription>
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
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Eletrônicos" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Opcional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria-pai (ID)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Opcional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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

export default function NerpCategoriesPage() {
  const query = useNerpCategories();
  const create = useCreateNerpCategory();
  const update = useUpdateNerpCategory();
  const remove = useDeleteNerpCategory();

  return (
    <NerpShell
      title="Categorias"
      description="Hierarquia de categorias do catálogo nerp."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </Button>
          <CategoryFormDialog
            title="Nova categoria"
            isPending={create.isPending}
            onSubmit={async (v) => {
              await create.mutateAsync(
                { ...v, parentId: v.parentId || undefined },
                {
                  onSuccess: () => toast.success("Categoria criada"),
                  onError: (err: { message?: string }) =>
                    toast.error(err?.message ?? "Falhou"),
                },
              );
            }}
            trigger={
              <Button size="sm">
                <Plus className="size-3.5" />
                Nova categoria
              </Button>
            }
          />
        </div>
      }
    >
      <NerpConnectionGuard>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Pai</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Produtos</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin inline mr-2" /> Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {query.data?.categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma categoria. Crie a primeira.
                    </TableCell>
                  </TableRow>
                )}
                {query.data?.categories.map((cat: Category) => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      <div className="font-medium">{cat.name}</div>
                      {cat.description && (
                        <div className="text-xs text-muted-foreground">{cat.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{cat.parentId ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={cat.isActive === false ? "secondary" : "default"}>
                        {cat.isActive === false ? "Inativa" : "Ativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {cat.productsCount ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <CategoryFormDialog
                          title="Editar categoria"
                          initialValues={{
                            name: cat.name,
                            description: cat.description ?? "",
                            parentId: cat.parentId ?? "",
                            isActive: cat.isActive,
                          }}
                          isPending={update.isPending}
                          onSubmit={async (v) => {
                            await update.mutateAsync(
                              {
                                id: cat.id,
                                ...v,
                                parentId: v.parentId || undefined,
                              },
                              {
                                onSuccess: () => toast.success("Categoria atualizada"),
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
                        <DeleteButton
                          title="Remover categoria?"
                          description={`A categoria "${cat.name}" será deletada do nerp.`}
                          isPending={remove.isPending}
                          onConfirm={() =>
                            remove.mutate(
                              { id: cat.id },
                              {
                                onSuccess: () => toast.success("Categoria removida"),
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
      </NerpConnectionGuard>
    </NerpShell>
  );
}
