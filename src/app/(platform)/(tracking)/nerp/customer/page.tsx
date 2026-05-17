"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, RefreshCw, Search } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  useNerpCustomers,
  useCreateNerpCustomer,
  useUpdateNerpCustomer,
  useDeleteNerpCustomer,
} from "../../../../../features/nerp/hooks/use-nerp-customers";

const formSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  document: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

function CustomerFormDialog({
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
      email: initialValues?.email ?? "",
      phone: initialValues?.phone ?? "",
      document: initialValues?.document ?? "",
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
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
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Documento (CPF/CNPJ)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
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

export default function NerpCustomerPage() {
  const [search, setSearch] = useState("");
  const query = useNerpCustomers(search ? { search } : undefined);
  const create = useCreateNerpCustomer();
  const update = useUpdateNerpCustomer();
  const remove = useDeleteNerpCustomer();

  return (
    <NerpShell
      title="Clientes"
      description="CRUD de clientes do nerp."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </Button>
          <CustomerFormDialog
            title="Novo cliente"
            isPending={create.isPending}
            onSubmit={async (v) => {
              await create.mutateAsync(
                {
                  name: v.name,
                  email: v.email || undefined,
                  phone: v.phone || undefined,
                  document: v.document || undefined,
                },
                {
                  onSuccess: () => toast.success("Cliente criado"),
                  onError: (err: { message?: string }) =>
                    toast.error(err?.message ?? "Falhou"),
                },
              );
            }}
            trigger={
              <Button size="sm">
                <Plus className="size-3.5" /> Novo cliente
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
              placeholder="Buscar cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin inline mr-2" /> Carregando…
                      </TableCell>
                    </TableRow>
                  )}
                  {query.data?.customers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {query.data?.customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                      <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                      <TableCell className="text-sm">{c.document ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {typeof c.salesCount === "number" ? (
                          <Badge variant="secondary">{c.salesCount}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <CustomerFormDialog
                            title="Editar cliente"
                            initialValues={{
                              name: c.name,
                              email: c.email ?? "",
                              phone: c.phone ?? "",
                              document: c.document ?? "",
                            }}
                            isPending={update.isPending}
                            onSubmit={async (v) => {
                              await update.mutateAsync(
                                {
                                  id: c.id,
                                  name: v.name,
                                  email: v.email || undefined,
                                  phone: v.phone || undefined,
                                  document: v.document || undefined,
                                },
                                {
                                  onSuccess: () => toast.success("Cliente atualizado"),
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
                            title="Remover cliente?"
                            description={`O cliente "${c.name}" será deletado do nerp.`}
                            isPending={remove.isPending}
                            onConfirm={() =>
                              remove.mutate(
                                { id: c.id },
                                {
                                  onSuccess: () => toast.success("Cliente removido"),
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
        </div>
      </NerpConnectionGuard>
    </NerpShell>
  );
}
