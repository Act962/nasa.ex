"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Trash2, Eye } from "lucide-react";
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
import {
  useNerpSales,
  useNerpSale,
  useCreateNerpSale,
} from "../../../../../features/nerp/hooks/use-nerp-sales";

const formSchema = z.object({
  customerId: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "ID obrigatório"),
        quantity: z.coerce.number().positive("Qtd > 0"),
        unitPrice: z.coerce.number().nonnegative(),
      }),
    )
    .min(1, "Adicione ao menos um item"),
});
type FormValues = z.infer<typeof formSchema>;

function formatBRL(n?: number | null) {
  return typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  pending: "secondary",
  draft: "outline",
  canceled: "destructive",
  refunded: "destructive",
};

function CreateSaleDialog({
  trigger,
  onSubmit,
  isPending,
}: {
  trigger: React.ReactNode;
  onSubmit: (values: FormValues) => Promise<void> | void;
  isPending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      customerId: "",
      paymentMethod: "",
      notes: "",
      items: [{ productId: "", quantity: 1, unitPrice: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const items = form.watch("items");
  const subtotal = items.reduce((acc, i) => acc + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const discount = form.watch("discount") || 0;
  const total = Math.max(0, subtotal - discount);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova venda</DialogTitle>
          <DialogDescription>Vendas são imutáveis após criação no nerp.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (v) => {
              await onSubmit(v);
              setOpen(false);
              form.reset();
            })}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente (ID)</FormLabel>
                    <FormControl><Input {...field} placeholder="Opcional" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de pagamento</FormLabel>
                    <FormControl><Input {...field} placeholder="pix, credito, …" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Itens</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ productId: "", quantity: 1, unitPrice: 0 })}
                >
                  <Plus className="size-3.5" /> Adicionar item
                </Button>
              </div>
              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto (ID)</TableHead>
                      <TableHead className="w-24">Qtd</TableHead>
                      <TableHead className="w-32">Preço unit.</TableHead>
                      <TableHead className="w-32 text-right">Subtotal</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((f, idx) => {
                      const it = items[idx];
                      const sub = (it?.quantity || 0) * (it?.unitPrice || 0);
                      return (
                        <TableRow key={f.id}>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${idx}.productId`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl><Input {...field} className="h-8" /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${idx}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl><Input {...field} type="number" className="h-8" /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${idx}.unitPrice`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl><Input {...field} type="number" step="0.01" className="h-8" /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {formatBRL(sub)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(idx)}
                              disabled={fields.length === 1}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-start">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl><Textarea {...field} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Desconto</FormLabel>
                      <FormControl><Input {...field} type="number" step="0.01" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="rounded bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatBRL(subtotal)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Desconto</span><span className="tabular-nums">- {formatBRL(discount)}</span></div>
                  <div className="flex justify-between font-medium border-t pt-1"><span>Total</span><span className="tabular-nums">{formatBRL(total)}</span></div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                Criar venda
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SaleDetailDialog({ saleId, trigger }: { saleId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const query = useNerpSale(saleId, open);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Detalhes da venda</DialogTitle>
          <DialogDescription className="font-mono text-xs">{saleId}</DialogDescription>
        </DialogHeader>
        {query.isLoading && (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline mr-2" /> Carregando…
          </div>
        )}
        {query.data && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={STATUS_VARIANTS[query.data.sale.status ?? ""] ?? "outline"}>
                {query.data.sale.status ?? "—"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-mono text-xs">{query.data.sale.customerId ?? "—"}</span>
            </div>
            <div className="rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.sale.items.map((i, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{i.productId}</TableCell>
                      <TableCell className="text-right">{i.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(i.unitPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="rounded bg-muted/50 p-3 space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatBRL(query.data.sale.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Desconto</span><span className="tabular-nums">{formatBRL(query.data.sale.discount)}</span></div>
              <div className="flex justify-between font-medium border-t pt-1"><span>Total</span><span className="tabular-nums">{formatBRL(query.data.sale.total)}</span></div>
            </div>
            {query.data.sale.notes && (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Observações</div>
                <div className="rounded border p-2 text-sm">{query.data.sale.notes}</div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function NerpSalesPage() {
  const query = useNerpSales();
  const create = useCreateNerpSale();

  return (
    <NerpShell
      title="Vendas"
      description="Vendas do nerp. Imutáveis após criação."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </Button>
          <CreateSaleDialog
            isPending={create.isPending}
            onSubmit={async (v) => {
              await create.mutateAsync(
                {
                  customerId: v.customerId || undefined,
                  paymentMethod: v.paymentMethod || undefined,
                  notes: v.notes || undefined,
                  discount: v.discount,
                  items: v.items,
                },
                {
                  onSuccess: () => toast.success("Venda criada"),
                  onError: (err: { message?: string }) =>
                    toast.error(err?.message ?? "Falhou"),
                },
              );
            }}
            trigger={
              <Button size="sm">
                <Plus className="size-3.5" /> Nova venda
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
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-20 text-right">Ver</TableHead>
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
                {query.data?.sales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma venda registrada.
                    </TableCell>
                  </TableRow>
                )}
                {query.data?.sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-mono text-xs">{s.customerId ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[s.status ?? ""] ?? "outline"}>
                        {s.status ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(s.total)}</TableCell>
                    <TableCell className="text-sm">{s.paymentMethod ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.createdAt ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <SaleDetailDialog
                        saleId={s.id}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Eye className="size-3.5" />
                          </Button>
                        }
                      />
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
