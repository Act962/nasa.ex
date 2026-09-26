"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useUpsertNerpCatalogIntegration } from "../../hooks/use-nerp-catalog-integration";

const FIRST_STATUS_VALUE = "__first__";

const settingsSchema = z.object({
  isActive: z.boolean(),
  ordersTrackingId: z.string().min(1, "Escolha o tracking que recebe os pedidos"),
  ordersStatusId: z.string(),
  logisticsTrackingId: z.string().min(1, "Escolha o tracking de logística"),
  logisticsStatusId: z.string(),
  whatsappNumber: z.string(),
  asaasApiKey: z.string(),
  asaasEnv: z.enum(["production", "sandbox"]),
});

type SettingsValues = z.infer<typeof settingsSchema>;

type TrackingOption = {
  id: string;
  name: string;
  isAiActive: boolean;
  statuses: { id: string; name: string }[];
};

type SavedSettings = {
  isActive: boolean;
  ordersTrackingId: string;
  ordersStatusId: string | null;
  logisticsTrackingId: string;
  logisticsStatusId: string | null;
  whatsappNumber: string | null;
  asaasEnv: "production" | "sandbox";
  asaasApiKeyLast4: string | null;
  hasAsaasKey: boolean;
  isWebhookConfigured: boolean;
};

interface CatalogOnlineSettingsFormProps {
  trackings: TrackingOption[];
  settings: SavedSettings | null;
  webhookUrl: string;
  canEdit: boolean;
}

function toFormValues(settings: SavedSettings | null): SettingsValues {
  return {
    isActive: settings?.isActive ?? true,
    ordersTrackingId: settings?.ordersTrackingId ?? "",
    ordersStatusId: settings?.ordersStatusId ?? FIRST_STATUS_VALUE,
    logisticsTrackingId: settings?.logisticsTrackingId ?? "",
    logisticsStatusId: settings?.logisticsStatusId ?? FIRST_STATUS_VALUE,
    whatsappNumber: settings?.whatsappNumber ?? "",
    asaasApiKey: "",
    asaasEnv: settings?.asaasEnv ?? "production",
  };
}

function toNullableStatus(value: string): string | null {
  return value === FIRST_STATUS_VALUE ? null : value;
}

function TrackingStagePicker({
  label,
  description,
  trackings,
  trackingValue,
  statusValue,
  onTrackingChange,
  onStatusChange,
  error,
}: {
  label: string;
  description: string;
  trackings: TrackingOption[];
  trackingValue: string;
  statusValue: string;
  onTrackingChange: (trackingId: string) => void;
  onStatusChange: (statusId: string) => void;
  error?: string;
}) {
  const selectedTracking = trackings.find((tracking) => tracking.id === trackingValue);
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={trackingValue} onValueChange={onTrackingChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tracking" />
          </SelectTrigger>
          <SelectContent>
            {trackings.map((tracking) => (
              <SelectItem key={tracking.id} value={tracking.id}>
                {tracking.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusValue} onValueChange={onStatusChange} disabled={!selectedTracking}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FIRST_STATUS_VALUE}>Primeira etapa do funil</SelectItem>
            {selectedTracking?.statuses.map((status) => (
              <SelectItem key={status.id} value={status.id}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FieldDescription>{description}</FieldDescription>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

export function CatalogOnlineSettingsForm({
  trackings,
  settings,
  webhookUrl,
  canEdit,
}: CatalogOnlineSettingsFormProps) {
  const upsert = useUpsertNerpCatalogIntegration();
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: toFormValues(settings),
  });

  useEffect(() => {
    form.reset(toFormValues(settings));
  }, [settings, form]);

  const ordersTrackingId = useWatch({ control: form.control, name: "ordersTrackingId" });
  const ordersStatusId = useWatch({ control: form.control, name: "ordersStatusId" });
  const logisticsTrackingId = useWatch({ control: form.control, name: "logisticsTrackingId" });
  const logisticsStatusId = useWatch({ control: form.control, name: "logisticsStatusId" });
  const ordersTracking = trackings.find((tracking) => tracking.id === ordersTrackingId);

  const handleSubmit = (values: SettingsValues) => {
    upsert.mutate(
      {
        isActive: values.isActive,
        ordersTrackingId: values.ordersTrackingId,
        ordersStatusId: toNullableStatus(values.ordersStatusId),
        logisticsTrackingId: values.logisticsTrackingId,
        logisticsStatusId: toNullableStatus(values.logisticsStatusId),
        whatsappNumber: values.whatsappNumber.trim() || null,
        asaasApiKey: values.asaasApiKey.trim() || undefined,
        asaasEnv: values.asaasEnv,
      },
      {
        onSuccess: (result) => {
          toast.success("Catálogo online configurado");
          if (result.webhookWarning) {
            toast.warning(
              `Webhook do Asaas não foi criado (${result.webhookWarning}). Os pagamentos serão confirmados por consulta periódica.`,
            );
          }
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada");
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6">
      <FieldGroup>
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="catalog-active" checked={field.value} onCheckedChange={field.onChange} />
              <FieldLabel htmlFor="catalog-active">Receber pedidos do Catálogo online</FieldLabel>
            </Field>
          )}
        />

        <TrackingStagePicker
          label="Onde o pedido chega"
          description="Tracking com o Astro (IA) ligado. O pedido vira lead nesta etapa e o Astro inicia a negociação."
          trackings={trackings}
          trackingValue={ordersTrackingId}
          statusValue={ordersStatusId}
          onTrackingChange={(trackingId) => {
            form.setValue("ordersTrackingId", trackingId, { shouldValidate: true });
            form.setValue("ordersStatusId", FIRST_STATUS_VALUE);
          }}
          onStatusChange={(statusId) => form.setValue("ordersStatusId", statusId)}
          error={form.formState.errors.ordersTrackingId?.message}
        />
        {ordersTracking && !ordersTracking.isAiActive && (
          <p className="flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="size-4" />
            A IA está desligada neste tracking — ligue o Astro nas configurações do tracking para ele negociar sozinho.
          </p>
        )}

        <TrackingStagePicker
          label="Depois do pagamento"
          description="Pagamento confirmado no Asaas move o lead para cá (logística/entrega). O nome da etapa aparece para o cliente no acompanhamento."
          trackings={trackings}
          trackingValue={logisticsTrackingId}
          statusValue={logisticsStatusId}
          onTrackingChange={(trackingId) => {
            form.setValue("logisticsTrackingId", trackingId, { shouldValidate: true });
            form.setValue("logisticsStatusId", FIRST_STATUS_VALUE);
          }}
          onStatusChange={(statusId) => form.setValue("logisticsStatusId", statusId)}
          error={form.formState.errors.logisticsTrackingId?.message}
        />

        <Controller
          control={form.control}
          name="whatsappNumber"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="catalog-whatsapp">WhatsApp da loja (opcional)</FieldLabel>
              <Input id="catalog-whatsapp" placeholder="5586999999999" {...field} />
              <FieldDescription>
                Número conectado ao tracking de pedidos. Vira o botão &quot;Continuar no WhatsApp&quot; — o cliente
                inicia a conversa, sem custo de template.
              </FieldDescription>
            </Field>
          )}
        />
      </FieldGroup>

      <FieldGroup>
        <Controller
          control={form.control}
          name="asaasApiKey"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="catalog-asaas-key">API key do Asaas da loja</FieldLabel>
              <Input
                id="catalog-asaas-key"
                type="password"
                autoComplete="off"
                placeholder={
                  settings?.hasAsaasKey
                    ? `Salva (termina em ${settings.asaasApiKeyLast4}) — preencha só para trocar`
                    : "$aact_..."
                }
                {...field}
              />
              <FieldDescription>
                Asaas → Integrações → Chave de API. Fica cifrada; o PIX cai direto na conta da loja.
              </FieldDescription>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="asaasEnv"
          render={({ field }) => (
            <Field>
              <FieldLabel>Ambiente Asaas</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full sm:w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Produção</SelectItem>
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Field>
          <FieldLabel>Webhook de pagamento</FieldLabel>
          <div className="flex items-center gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copyWebhookUrl}>
              <Copy className="size-4" />
            </Button>
          </div>
          <FieldDescription>
            {settings?.isWebhookConfigured
              ? "Criado automaticamente na sua conta Asaas."
              : "Criado automaticamente ao salvar a chave. Sem ele, o Órbita confere o pagamento a cada poucos minutos."}
          </FieldDescription>
        </Field>
      </FieldGroup>

      <div className="flex justify-end">
        {!canEdit && (
          <p className="mr-auto self-center text-xs text-muted-foreground">
            Somente leitura: seu papel não pode editar o Catálogo online.
          </p>
        )}
        <Button type="submit" disabled={upsert.isPending || !canEdit}>
          {upsert.isPending && <Loader2 className="size-4 animate-spin" />}
          Salvar configuração
        </Button>
      </div>
    </form>
  );
}
