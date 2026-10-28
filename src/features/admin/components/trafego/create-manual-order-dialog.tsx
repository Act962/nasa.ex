"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoPlatform,
} from "@/generated/prisma/enums";
import { useCreateManualTrafegoOrder } from "@/features/trafego/hooks/use-trafego-admin";
import {
  CAMPAIGN_TYPES_BY_PLATFORM,
  CAMPAIGN_TYPE_SHORT_LABEL,
  OBJECTIVES_BY_PLATFORM,
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { quoteTrafego } from "@/features/trafego/lib/pricing-tiers";
import { useAdminPath } from "@/features/trafego/lib/base-path";
import { OrganizationCombobox } from "./settings/organization-combobox";
import {
  ChoiceChip,
  SettingsDivider,
  SettingsField,
  SettingsGrid,
  SettingsNotice,
} from "./settings/settings-primitives";

const PLATFORMS = Object.keys(PLATFORM_SHORT_LABEL) as TrafegoPlatform[];
const PAYMENT_METHOD_LABEL = { PIX: "PIX", CARD: "Cartão" } as const;
type ManualPaymentMethod = keyof typeof PAYMENT_METHOD_LABEL;

function brlInputToCents(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function centsToBrlInput(cents: number): string {
  return String(cents / 100);
}

function tableFeesFor(adBudgetBrl: string) {
  const quote = quoteTrafego(brlInputToCents(adBudgetBrl), true);
  return {
    serviceFeeBrl: centsToBrlInput(quote.serviceFeeBrlCents),
    setupFeeBrl: centsToBrlInput(quote.setupBrlCents),
  };
}

const INITIAL_BUDGET_BRL = "500";

const emptyManualOrderForm = {
  organizationId: "",
  platform: "META_ADS" as TrafegoPlatform,
  campaignType: "PROSPECCAO" as TrafegoCampaignType,
  objective: "LEADS" as TrafegoObjective,
  paymentMethod: "PIX" as ManualPaymentMethod,
  adBudgetBrl: INITIAL_BUDGET_BRL,
  ...tableFeesFor(INITIAL_BUDGET_BRL),
  durationDays: "30",
  maxCreatives: "3",
  maxCopies: "3",
  businessName: "",
  whatsappNumber: "",
  internalNote: "",
  registerFinance: true,
};

/** Pedido de cliente que pagou fora da landing (spec 0116). */
export function CreateManualOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const adminPath = useAdminPath();
  const createManualOrder = useCreateManualTrafegoOrder();
  const [form, setForm] = useState(emptyManualOrderForm);

  const adBudgetBrlCents = brlInputToCents(form.adBudgetBrl);
  const serviceFeeBrlCents = brlInputToCents(form.serviceFeeBrl);
  const setupFeeBrlCents = brlInputToCents(form.setupFeeBrl);
  const totalBrlCents = adBudgetBrlCents + serviceFeeBrlCents + setupFeeBrlCents;

  const isValid =
    Boolean(form.organizationId) &&
    adBudgetBrlCents >= 100 &&
    serviceFeeBrlCents >= 0 &&
    setupFeeBrlCents >= 0 &&
    Number(form.durationDays) >= 1 &&
    Number(form.maxCreatives) >= 1 &&
    Number(form.maxCopies) >= 1;

  function patch(partial: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function handlePlatformChange(platform: TrafegoPlatform) {
    // Objetivo e tipo são por canal: manter o anterior criaria um pedido que o
    // canal não atende.
    patch({
      platform,
      objective: OBJECTIVES_BY_PLATFORM[platform][0],
      campaignType: CAMPAIGN_TYPES_BY_PLATFORM[platform][0],
    });
  }

  function handleCreate() {
    createManualOrder.mutate(
      {
        organizationId: form.organizationId,
        platform: form.platform,
        campaignType: form.campaignType,
        objective: form.objective,
        paymentMethod: form.paymentMethod,
        adBudgetBrlCents,
        serviceFeeBrlCents,
        setupFeeBrlCents,
        durationDays: Number(form.durationDays),
        maxCreatives: Number(form.maxCreatives),
        maxCopies: Number(form.maxCopies),
        businessName: form.businessName.trim() || undefined,
        whatsappNumber: form.whatsappNumber.trim() || undefined,
        internalNote: form.internalNote.trim() || undefined,
        registerFinance: form.registerFinance,
      },
      {
        onSuccess: ({ orderId, code }) => {
          toast.success(`Pedido ${code} criado — o cliente já vê no painel.`);
          setForm(emptyManualOrderForm);
          onOpenChange(false);
          router.push(`${adminPath}/${orderId}`);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pedido avulso</DialogTitle>
          <DialogDescription>
            Para cliente que pagou fora da plataforma. O pedido entra em análise da conta
            e o cliente segue pelo painel como em qualquer compra.
          </DialogDescription>
        </DialogHeader>

        <SettingsGrid>
          <SettingsField label="Empresa do cliente" wide>
            <OrganizationCombobox
              value={form.organizationId}
              onChange={(organizationId) => patch({ organizationId })}
              placeholder="Selecione a empresa"
            />
          </SettingsField>

          <SettingsDivider title="Campanha" />

          <SettingsField label="Canal" wide>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((platform) => (
                <ChoiceChip
                  key={platform}
                  isOn={form.platform === platform}
                  onClick={() => handlePlatformChange(platform)}
                >
                  {PLATFORM_SHORT_LABEL[platform]}
                </ChoiceChip>
              ))}
            </div>
          </SettingsField>

          <SettingsField label="Tipo de campanha" wide>
            <div className="flex flex-wrap gap-1.5">
              {CAMPAIGN_TYPES_BY_PLATFORM[form.platform].map((campaignType) => (
                <ChoiceChip
                  key={campaignType}
                  isOn={form.campaignType === campaignType}
                  onClick={() => patch({ campaignType })}
                >
                  {CAMPAIGN_TYPE_SHORT_LABEL[campaignType]}
                </ChoiceChip>
              ))}
            </div>
          </SettingsField>

          <SettingsField label="Objetivo" wide>
            <div className="flex flex-wrap gap-1.5">
              {OBJECTIVES_BY_PLATFORM[form.platform].map((objective) => (
                <ChoiceChip
                  key={objective}
                  isOn={form.objective === objective}
                  onClick={() => patch({ objective })}
                >
                  {OBJECTIVE_LABEL[objective]}
                </ChoiceChip>
              ))}
            </div>
          </SettingsField>

          <SettingsDivider title="Pagamento" />

          <SettingsField label="Como o cliente pagou" wide>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PAYMENT_METHOD_LABEL) as ManualPaymentMethod[]).map(
                (paymentMethod) => (
                  <ChoiceChip
                    key={paymentMethod}
                    isOn={form.paymentMethod === paymentMethod}
                    onClick={() => patch({ paymentMethod })}
                  >
                    {PAYMENT_METHOD_LABEL[paymentMethod]}
                  </ChoiceChip>
                ),
              )}
            </div>
          </SettingsField>

          <SettingsField label="Verba de tráfego (R$)">
            <Input
              type="number"
              min={1}
              value={form.adBudgetBrl}
              onChange={(event) => patch({ adBudgetBrl: event.target.value })}
            />
          </SettingsField>

          <SettingsField
            label="Taxa de serviço (R$)"
            action={
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => patch(tableFeesFor(form.adBudgetBrl))}
              >
                Usar tabela
              </button>
            }
          >
            <Input
              type="number"
              min={0}
              value={form.serviceFeeBrl}
              onChange={(event) => patch({ serviceFeeBrl: event.target.value })}
            />
          </SettingsField>

          <SettingsField label="Setup (R$)" hint="Zero se o cliente já tinha a conta pronta.">
            <Input
              type="number"
              min={0}
              value={form.setupFeeBrl}
              onChange={(event) => patch({ setupFeeBrl: event.target.value })}
            />
          </SettingsField>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm sm:col-span-2">
            <div className="flex justify-between text-muted-foreground">
              <span>Verba</span>
              <span className="tabular-nums">{formatBrlFromCents(adBudgetBrlCents)}</span>
            </div>
            <div className="mt-1 flex justify-between text-muted-foreground">
              <span>Taxa + setup</span>
              <span className="tabular-nums">
                {formatBrlFromCents(serviceFeeBrlCents + setupFeeBrlCents)}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
              <span>Cliente pagou</span>
              <span className="tabular-nums">{formatBrlFromCents(totalBrlCents)}</span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs sm:col-span-2">
            <Switch
              checked={form.registerFinance}
              onCheckedChange={(registerFinance) => patch({ registerFinance })}
            />
            Lançar no financeiro (receita da taxa + setup e repasse da verba)
          </label>
          {!form.registerFinance && (
            <SettingsNotice tone="info">
              Nada será lançado no financeiro. Use quando a venda já foi registrada à mão.
            </SettingsNotice>
          )}

          <SettingsDivider title="Entregáveis" />

          <SettingsField label="Duração (dias)">
            <Input
              type="number"
              min={1}
              value={form.durationDays}
              onChange={(event) => patch({ durationDays: event.target.value })}
            />
          </SettingsField>

          <SettingsField label="Máx. criativos">
            <Input
              type="number"
              min={1}
              value={form.maxCreatives}
              onChange={(event) => patch({ maxCreatives: event.target.value })}
            />
          </SettingsField>

          <SettingsField label="Máx. copies">
            <Input
              type="number"
              min={1}
              value={form.maxCopies}
              onChange={(event) => patch({ maxCopies: event.target.value })}
            />
          </SettingsField>

          <SettingsDivider title="Cliente" />

          <SettingsField label="Nome do negócio" hint="Vazio = nome da empresa.">
            <Input
              value={form.businessName}
              onChange={(event) => patch({ businessName: event.target.value })}
            />
          </SettingsField>

          <SettingsField label="WhatsApp" hint="Vazio = telefone do dono da empresa.">
            <Input
              value={form.whatsappNumber}
              onChange={(event) => patch({ whatsappNumber: event.target.value })}
              placeholder="(86) 99999-9999"
            />
          </SettingsField>

          <SettingsField label="Observação interna" wide>
            <Textarea
              value={form.internalNote}
              onChange={(event) => patch({ internalNote: event.target.value })}
              rows={2}
              placeholder="Ex.: pago por transferência em 25/10, contrato assinado."
            />
          </SettingsField>
        </SettingsGrid>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!isValid || createManualOrder.isPending}>
            {createManualOrder.isPending && <OrbitaSpinner className="mr-1.5 size-4" />}
            Criar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
