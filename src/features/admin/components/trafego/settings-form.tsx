"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useTrafegoSettings,
  useUpdateTrafegoSettings,
} from "@/features/trafego/hooks/use-trafego-admin";

/**
 * Ajustes globais. `agencyOrganizationId` é o mais importante: sem ele os
 * lançamentos financeiros não são criados e o cliente não vê métricas do Meta,
 * porque os snapshots nascem na organização que detém a integração.
 */
export function TrafegoSettingsForm() {
  const { data: settings, isLoading } = useTrafegoSettings();
  const updateSettings = useUpdateTrafegoSettings();

  const [form, setForm] = useState({
    agencyOrganizationId: "",
    defaultBroadcastTrackingId: "",
    salesTrackingId: "",
    salesStatusId: "",
    defaultServiceFeePercent: "50",
    supportWhatsapp: "",
  });

  useEffect(() => {
    if (!settings) return;
    setForm({
      agencyOrganizationId: settings.agencyOrganizationId ?? "",
      defaultBroadcastTrackingId: settings.defaultBroadcastTrackingId ?? "",
      salesTrackingId: settings.salesTrackingId ?? "",
      salesStatusId: settings.salesStatusId ?? "",
      defaultServiceFeePercent: String(settings.defaultServiceFeePercent ?? 50),
      supportWhatsapp: settings.supportWhatsapp ?? "",
    });
  }, [settings]);

  function handleSave() {
    const emptyToNull = (value: string) => (value.trim() ? value.trim() : null);

    updateSettings.mutate(
      {
        agencyOrganizationId: emptyToNull(form.agencyOrganizationId),
        defaultBroadcastTrackingId: emptyToNull(form.defaultBroadcastTrackingId),
        salesTrackingId: emptyToNull(form.salesTrackingId),
        salesStatusId: emptyToNull(form.salesStatusId),
        defaultServiceFeePercent: Number(form.defaultServiceFeePercent),
        supportWhatsapp: emptyToNull(form.supportWhatsapp),
      },
      {
        onSuccess: () => toast.success("Ajustes salvos."),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando ajustes…
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">Ajustes do trafeGO</h2>
      <p className="text-sm text-muted-foreground">
        Onde as vendas são lançadas e de onde vêm as métricas.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs">Organização da agência</Label>
          <Input
            value={form.agencyOrganizationId}
            onChange={(event) =>
              setForm({ ...form, agencyOrganizationId: event.target.value })
            }
            placeholder="ID da org da NASA que roda os anúncios"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            É a org que detém a integração com o Meta. Sem ela, os lançamentos
            financeiros não são criados e o cliente não vê métricas.
          </p>
        </div>

        <div>
          <Label className="text-xs">Tracking de vendas (CRM)</Label>
          <Input
            value={form.salesTrackingId}
            onChange={(event) =>
              setForm({ ...form, salesTrackingId: event.target.value })
            }
            placeholder="ID do tracking"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs">Coluna de entrada</Label>
          <Input
            value={form.salesStatusId}
            onChange={(event) =>
              setForm({ ...form, salesStatusId: event.target.value })
            }
            placeholder="Opcional — usa a primeira coluna se vazio"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs">Tracking padrão de disparo</Label>
          <Input
            value={form.defaultBroadcastTrackingId}
            onChange={(event) =>
              setForm({ ...form, defaultBroadcastTrackingId: event.target.value })
            }
            placeholder="Número META_CLOUD de origem"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs">Taxa de serviço padrão (%)</Label>
          <Input
            type="number"
            value={form.defaultServiceFeePercent}
            onChange={(event) =>
              setForm({ ...form, defaultServiceFeePercent: event.target.value })
            }
            className="mt-1"
          />
        </div>

        <div className="sm:col-span-2">
          <Label className="text-xs">WhatsApp de suporte</Label>
          <Input
            value={form.supportWhatsapp}
            onChange={(event) =>
              setForm({ ...form, supportWhatsapp: event.target.value })
            }
            placeholder="(11) 90000-0000"
            className="mt-1"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 size-4" />
          )}
          Salvar ajustes
        </Button>
      </div>
    </div>
  );
}
