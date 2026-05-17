"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  useNerpCatalogSettings,
  useUpdateNerpCatalogSettings,
} from "../../../../../features/nerp/hooks/use-nerp-catalog-settings";

const formSchema = z.object({
  currency: z.string().optional(),
  defaultPriceListId: z.string().optional(),
  visibility: z.enum(["public", "private", "linked"]).optional(),
});
type FormValues = z.infer<typeof formSchema>;

export default function NerpCatalogSettingsPage() {
  const query = useNerpCatalogSettings();
  const update = useUpdateNerpCatalogSettings();

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: { currency: "", defaultPriceListId: "", visibility: undefined },
  });

  useEffect(() => {
    if (query.data?.catalogSettings) {
      form.reset({
        currency: query.data.catalogSettings.currency ?? "",
        defaultPriceListId: query.data.catalogSettings.defaultPriceListId ?? "",
        visibility: query.data.catalogSettings.visibility,
      });
    }
  }, [query.data, form]);

  return (
    <NerpShell
      title="Configurações do catálogo"
      description="Ajustes gerais do catálogo nerp (moeda, visibilidade, lista de preços)."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        </Button>
      }
    >
      <NerpConnectionGuard>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>
              Apenas administradores da organização podem alterar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((v) =>
                  update.mutate(
                    {
                      currency: v.currency || undefined,
                      defaultPriceListId: v.defaultPriceListId || undefined,
                      visibility: v.visibility,
                    },
                    {
                      onSuccess: () => toast.success("Configurações atualizadas"),
                      onError: (err: { message?: string }) =>
                        toast.error(err?.message ?? "Falhou"),
                    },
                  ),
                )}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moeda</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="BRL, USD, EUR…" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultPriceListId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lista de preços padrão (ID)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Opcional" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibilidade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="public">Público</SelectItem>
                          <SelectItem value="private">Privado</SelectItem>
                          <SelectItem value="linked">Por link</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Salvar
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </NerpConnectionGuard>
    </NerpShell>
  );
}
