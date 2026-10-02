"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useUpsertStarFriendsProgram } from "../hooks/use-star-friends";

const programSchema = z.object({
  isActive: z.boolean(),
  name: z.string().trim().min(2, "Informe o nome"),
  starsPerPurchase: z.number().int().min(1),
  minPurchaseAmount: z.number().min(0),
  starsExpireDays: z.number().int().min(1).nullable(),
  countCatalogOrders: z.boolean(),
  countForgeProposals: z.boolean(),
  rules: z.string().nullable(),
});

type ProgramValues = z.infer<typeof programSchema>;

const DEFAULT_PROGRAM: ProgramValues = {
  isActive: true,
  name: "STAR FRIENDS",
  starsPerPurchase: 1,
  minPurchaseAmount: 0,
  starsExpireDays: null,
  countCatalogOrders: true,
  countForgeProposals: true,
  rules: null,
};

export function ProgramSettingsForm({
  program,
}: {
  program: ProgramValues | null;
}) {
  const upsert = useUpsertStarFriendsProgram();
  const form = useForm<ProgramValues>({
    resolver: zodResolver(programSchema),
    defaultValues: program ?? DEFAULT_PROGRAM,
  });

  useEffect(() => {
    form.reset(program ?? DEFAULT_PROGRAM);
  }, [program, form]);

  const toNumberOrNull = (value: string) =>
    value === "" ? null : Number(value);

  return (
    <form
      className="flex w-full flex-col gap-4 rounded-[20px] border border-line bg-card p-4 md:max-w-2xl md:p-5"
      onSubmit={form.handleSubmit((values) =>
        upsert.mutate(values, {
          onSuccess: () => toast.success("Regras salvas"),
          onError: (error) => toast.error(error.message),
        }),
      )}
    >
      <FieldGroup>
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <Field
              orientation="horizontal"
              className="items-center justify-between gap-4 rounded-[18px] bg-muted p-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <FieldLabel htmlFor="program-active">Programa ativo</FieldLabel>
                <FieldDescription>
                  Pausar não apaga o saldo de ninguém.
                </FieldDescription>
              </div>
              <Switch
                id="program-active"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="name"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="program-name">
                Nome exibido ao cliente
              </FieldLabel>
              <Input id="program-name" {...field} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="starsPerPurchase"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="program-stars">
                Stars por compra paga
              </FieldLabel>
              <Input
                id="program-stars"
                type="number"
                min={1}
                value={field.value}
                onChange={(event) => field.onChange(Number(event.target.value))}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="minPurchaseAmount"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="program-min">
                Valor mínimo da compra (R$)
              </FieldLabel>
              <Input
                id="program-min"
                type="number"
                min={0}
                step="0.01"
                value={field.value}
                onChange={(event) => field.onChange(Number(event.target.value))}
              />
              <FieldDescription>
                Compras abaixo disso não geram star. 0 = qualquer valor.
              </FieldDescription>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="starsExpireDays"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="program-expire">
                Validade das stars (dias)
              </FieldLabel>
              <Input
                id="program-expire"
                type="number"
                min={1}
                placeholder="Em branco = não expiram"
                value={field.value ?? ""}
                onChange={(event) =>
                  field.onChange(toNumberOrNull(event.target.value))
                }
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="countCatalogOrders"
          render={({ field }) => (
            <Field
              orientation="horizontal"
              className="items-center justify-between gap-4 rounded-[18px] bg-muted p-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <FieldLabel htmlFor="program-catalog">
                  Catálogo online
                </FieldLabel>
                <FieldDescription>
                  Pontuar pedidos pagos do Catálogo online.
                </FieldDescription>
              </div>
              <Switch
                id="program-catalog"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="countForgeProposals"
          render={({ field }) => (
            <Field
              orientation="horizontal"
              className="items-center justify-between gap-4 rounded-[18px] bg-muted p-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <FieldLabel htmlFor="program-forge">
                  Propostas do Forge
                </FieldLabel>
                <FieldDescription>
                  Pontuar propostas do Forge marcadas como pagas.
                </FieldDescription>
              </div>
              <Switch
                id="program-forge"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="rules"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="program-rules">
                Regulamento (opcional)
              </FieldLabel>
              <Textarea
                id="program-rules"
                rows={4}
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value || null)}
              />
            </Field>
          )}
        />
      </FieldGroup>
      <Button
        type="submit"
        className="w-full rounded-full sm:w-fit"
        disabled={upsert.isPending}
      >
        {upsert.isPending && <OrbitaSpinner className="size-4 " />}
        Salvar regras
      </Button>
    </form>
  );
}
