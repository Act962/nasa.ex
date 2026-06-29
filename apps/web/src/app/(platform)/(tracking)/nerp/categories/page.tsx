"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, RefreshCw } from "lucide-react";
import { slugify } from "@/utils/create-slug";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NerpShell } from "../../../../../features/nerp/components/nerp-shell";
import { NerpConnectionGuard } from "../../../../../features/nerp/components/connection-guard";
import { DeleteButton } from "../../../../../features/nerp/components/delete-button";
import {
  useNerpCategories,
  useCreateNerpCategory,
  useUpdateNerpCategory,
  useDeleteNerpCategory,
} from "../../../../../features/nerp/hooks/use-nerp-categories";

// `slug` é obrigatório no nerp (`categories.create`/`update`). `isActive` não
// existe no payload — categorias do nerp não têm flag de ativa/inativa.
const formSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  slug: z.string().min(1, "Slug obrigatório"),
  description: z.string().optional(),
  parentId: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

// Select não aceita `""` como value; usamos sentinela e convertemos pra
// string vazia no form quando o usuário marca "sem pai".
const NO_PARENT_VALUE = "__none__";

// Lista enxuta passada pro dropdown — só id+name.
type ParentOption = { id: string; name: string };

type CategoryChild = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productsCount: number;
  parentId: string | null;
};
type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productsCount: number;
  children: CategoryChild[];
};

function CategoryFormDialog({
  trigger,
  initialValues,
  onSubmit,
  isPending,
  title,
  parentOptions,
  selfId,
}: {
  trigger: React.ReactNode;
  initialValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void> | void;
  isPending?: boolean;
  title: string;
  parentOptions: ParentOption[];
  // Ao editar, exclui a própria categoria do dropdown (não pode ser pai de si).
  selfId?: string;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: initialValues?.name ?? "",
      slug: initialValues?.slug ?? "",
      description: initialValues?.description ?? "",
      parentId: initialValues?.parentId ?? "",
    },
  });

  // Auto-deriva o slug do nome. Para a sincronização assim que o usuário
  // edita o slug manualmente (não queremos sobrescrever a customização dele).
  // Em edição, começamos com `userTouchedSlug = true` quando o slug existente
  // não bate com o slugify do nome — sinal de que já foi customizado.
  const userTouchedSlugRef = useRef(
    initialValues?.slug
      ? initialValues.slug !== slugify(initialValues.name ?? "")
      : false,
  );
  const watchedName = form.watch("name");
  useEffect(() => {
    if (userTouchedSlugRef.current) return;
    form.setValue("slug", slugify(watchedName ?? ""), {
      shouldValidate: false,
    });
  }, [watchedName, form]);

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
              userTouchedSlugRef.current = false;
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
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="ex-eletronicos"
                      // Gerado automaticamente a partir do nome. Ao digitar
                      // aqui, paramos de sincronizar pra respeitar a edição.
                      onChange={(e) => {
                        userTouchedSlugRef.current = true;
                        field.onChange(e);
                      }}
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
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Ex: Dispositivos eletrônicos como celulares, fones e tablets"
                    />
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
                  <FormLabel>Categoria-pai</FormLabel>
                  <Select
                    value={field.value ? field.value : NO_PARENT_VALUE}
                    onValueChange={(v) =>
                      field.onChange(v === NO_PARENT_VALUE ? "" : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar categoria-pai" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_PARENT_VALUE}>
                        Sem pai (top-level)
                      </SelectItem>
                      {parentOptions
                        .filter((c) => c.id !== selfId)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      {parentOptions.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Nenhuma categoria disponível.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
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

  // nerp suporta só 1 nível de hierarquia (parent + children) — apenas
  // top-level pode ser pai. `query.data.categories` já é a lista top-level.
  const parentOptions: ParentOption[] = (query.data?.categories ?? []).map(
    (c) => ({ id: c.id, name: c.name }),
  );

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
            parentOptions={parentOptions}
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
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Subcategorias</TableHead>
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
                    <TableCell className="font-mono text-xs">{cat.slug}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{cat.children.length}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {cat.productsCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <CategoryFormDialog
                          title="Editar categoria"
                          initialValues={{
                            name: cat.name,
                            slug: cat.slug,
                            description: cat.description ?? "",
                            parentId: "",
                          }}
                          isPending={update.isPending}
                          parentOptions={parentOptions}
                          selfId={cat.id}
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
