"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import { useUpsertStarFriendsCampaign } from "../hooks/use-star-friends-campaign";
import { toBrasiliaDay } from "../utils/campaign";

const ANY_FUNNEL = "any";

const campaignSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome da campanha"),
  isActive: z.boolean(),
  startsOn: z.string().min(10, "Informe o início"),
  endsOn: z.string().min(10, "Informe o fim"),
  amountPerNumber: z.number().min(1),
  issuerDocuments: z.string(),
  rulesSummary: z.string().trim().min(20, "Escreva o resumo das regras").max(700),
  rulesUrl: z.string().trim(),
  trackingId: z.string(),
  maxReceiptsPerDay: z.number().int().min(1).max(50),
  prizeCount: z.number().int().min(1).max(100),
});

type CampaignValues = z.infer<typeof campaignSchema>;

export type CampaignFormSource = {
  id: string;
  name: string;
  isActive: boolean;
  startsAt: Date | string;
  endsAt: Date | string;
  amountPerNumberCents: number;
  issuerDocuments: string[];
  rulesSummary: string;
  rulesUrl: string | null;
  trackingId: string | null;
  maxReceiptsPerDay: number;
  prizeCount: number;
};

const DEFAULT_RULES =
  "A cada R$ 100,00 em compras você ganha 1 número da sorte. Envie a foto do cupom por aqui. Cada cupom vale uma vez só e os cupons são conferidos antes do sorteio: cupom repetido ou irregular tem os números cancelados.";

// O fim é gravado como 23:59 de Brasília, que em UTC já é o dia seguinte.
function toDateInput(value: Date | string): string {
  return toBrasiliaDay(new Date(value));
}

function toValues(campaign: CampaignFormSource | null): CampaignValues {
  const today = new Date();
  const inThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    name: campaign?.name ?? "",
    isActive: campaign?.isActive ?? false,
    startsOn: toDateInput(campaign?.startsAt ?? today),
    endsOn: toDateInput(campaign?.endsAt ?? inThirtyDays),
    amountPerNumber: (campaign?.amountPerNumberCents ?? 10_000) / 100,
    issuerDocuments: campaign?.issuerDocuments.join(", ") ?? "",
    rulesSummary: campaign?.rulesSummary ?? DEFAULT_RULES,
    rulesUrl: campaign?.rulesUrl ?? "",
    trackingId: campaign?.trackingId ?? ANY_FUNNEL,
    maxReceiptsPerDay: campaign?.maxReceiptsPerDay ?? 5,
    prizeCount: campaign?.prizeCount ?? 1,
  };
}

export function CampaignForm({ campaign, trackings }: { campaign: CampaignFormSource | null; trackings: { id: string; name: string }[] }) {
  const upsert = useUpsertStarFriendsCampaign();
  const form = useForm<CampaignValues>({ resolver: zodResolver(campaignSchema), defaultValues: toValues(campaign) });

  useEffect(() => {
    form.reset(toValues(campaign));
  }, [campaign, form]);

  return (
    <form
      className="flex w-full flex-col gap-4 rounded-[20px] border border-line bg-card p-4 md:max-w-2xl md:p-5"
      onSubmit={form.handleSubmit((values) =>
        upsert.mutate(
          {
            id: campaign?.id,
            name: values.name,
            isActive: values.isActive,
            // O dia do fim vale inteiro, no horário de Brasília.
            startsAt: new Date(`${values.startsOn}T00:00:00-03:00`),
            endsAt: new Date(`${values.endsOn}T23:59:59-03:00`),
            amountPerNumberCents: Math.round(values.amountPerNumber * 100),
            issuerDocuments: values.issuerDocuments.split(/[,;\n]/).map((document) => document.trim()).filter(Boolean),
            rulesSummary: values.rulesSummary,
            rulesUrl: values.rulesUrl || null,
            trackingId: values.trackingId === ANY_FUNNEL ? null : values.trackingId,
            maxReceiptsPerDay: values.maxReceiptsPerDay,
            prizeCount: values.prizeCount,
          },
          {
            onSuccess: () => {
              toast.success("Campanha salva");
              emitTourResult({ kind: GUIDE_RESULT_KINDS.loyaltyCampaignSaved });
            },
            onError: (error) => toast.error(error.message),
          },
        ),
      )}
    >
      <FieldGroup>
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <Field orientation="horizontal" className="items-center justify-between gap-4 rounded-[18px] bg-muted p-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <FieldLabel htmlFor="campaign-active">Campanha ativa</FieldLabel>
                <FieldDescription>Só com ela ativa o WhatsApp recebe cupons.</FieldDescription>
              </div>
              <Switch id="campaign-active" checked={field.value} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="campaign-name">Nome da campanha</FieldLabel>
              <Input id="campaign-name" placeholder="Ex.: 15 anos — Comprou, Participou!" {...field} />
              {fieldState.error && <FieldDescription className="text-destructive">{fieldState.error.message}</FieldDescription>}
            </Field>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="startsOn"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="campaign-start">Início</FieldLabel>
                <Input id="campaign-start" type="date" {...field} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="endsOn"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="campaign-end">Fim</FieldLabel>
                <Input id="campaign-end" type="date" {...field} />
              </Field>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="amountPerNumber"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="campaign-amount">Valor por número da sorte (R$)</FieldLabel>
                <Input id="campaign-amount" type="number" min={1} step="0.01" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
                <FieldDescription>A sobra de um cupom soma no próximo.</FieldDescription>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="maxReceiptsPerDay"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="campaign-limit">Cupons por cliente por dia</FieldLabel>
                <Input id="campaign-limit" type="number" min={1} max={50} value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
              </Field>
            )}
          />
        </div>
        <Controller
          control={form.control}
          name="prizeCount"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="campaign-prizes">Quantidade de prêmios</FieldLabel>
              <Input id="campaign-prizes" type="number" min={1} max={100} value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} />
              <FieldDescription>O sorteio tira um número para cada prêmio. Cada cliente ganha no máximo um.</FieldDescription>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="issuerDocuments"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="campaign-documents">CNPJ da loja</FieldLabel>
              <Input id="campaign-documents" placeholder="00.000.000/0001-00" {...field} />
              <FieldDescription>Cupom de outro CNPJ é recusado. Mais de uma loja: separe por vírgula. Vazio = aceita qualquer CNPJ.</FieldDescription>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="trackingId"
          render={({ field }) => (
            <Field>
              <FieldLabel>Funil do WhatsApp</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_FUNNEL}>Qualquer funil</SelectItem>
                  {trackings.map((tracking) => (
                    <SelectItem key={tracking.id} value={tracking.id}>
                      {tracking.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="rulesSummary"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="campaign-rules">Resumo das regras</FieldLabel>
              <Textarea id="campaign-rules" rows={5} maxLength={700} {...field} />
              <FieldDescription className={fieldState.error ? "text-destructive" : undefined}>
                {fieldState.error?.message ?? "O cliente lê este texto no WhatsApp antes de aceitar."}
              </FieldDescription>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="rulesUrl"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="campaign-rules-url">Link do regulamento completo</FieldLabel>
              <Input id="campaign-rules-url" type="url" placeholder="https://..." {...field} />
              <FieldDescription>A página da campanha feita no Pages.</FieldDescription>
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" className="self-start rounded-full" disabled={upsert.isPending} data-guide={GUIDE_ANCHORS.starFriendsCampaignSave.id}>
        {upsert.isPending && <OrbitaSpinner className="size-4" />} Salvar campanha
      </Button>
    </form>
  );
}
