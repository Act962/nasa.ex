"use client";

import { useState } from "react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  TrafegoOrderStatus,
  TrafegoPlatform,
} from "@/generated/prisma/enums";
import { useCorrectTrafegoOrderValues } from "@/features/trafego/hooks/use-trafego-admin";
import {
  CAMPAIGN_TYPES_BY_PLATFORM,
  CAMPAIGN_TYPE_SHORT_LABEL,
  OBJECTIVES_BY_PLATFORM,
  OBJECTIVE_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  billedAdBudgetBrlCents,
  deriveExtraCreativesBrlCents,
  isOrderValueCorrectable,
} from "@/features/trafego/lib/order-values";
import { ChoiceChip, SettingsField, SettingsGrid, SettingsNotice } from "./settings/settings-primitives";

/** "Corrigir valores" de um pedido antes de ir ao ar (spec 0122, RF-16..RF-19). */

interface CorrectableOrder {
  id: string;
  code: string;
  status: TrafegoOrderStatus;
  platform: TrafegoPlatform;
  campaignType: TrafegoCampaignType;
  objective: TrafegoObjective;
  durationDays: number;
  adBudgetBrlCents: number;
  serviceFeeBrlCents: number;
  setupFeeBrlCents: number;
  totalBrlCents: number;
  adBudgetPaidToMeta: boolean;
  pendingPurchaseId: string | null;
}

function brlInputToCents(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function CorrectOrderValuesButton({ order }: { order: CorrectableOrder }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!isOrderValueCorrectable(order.status)) return null;

  return (
    <>
      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setIsOpen(true)}>
        Corrigir valores
      </Button>
      {isOpen && <CorrectOrderValuesDialog order={order} onClose={() => setIsOpen(false)} />}
    </>
  );
}

function CorrectOrderValuesDialog({ order, onClose }: { order: CorrectableOrder; onClose: () => void }) {
  const correctValues = useCorrectTrafegoOrderValues();
  const [adBudgetBrl, setAdBudgetBrl] = useState(String(order.adBudgetBrlCents / 100));
  const [serviceFeeBrl, setServiceFeeBrl] = useState(String(order.serviceFeeBrlCents / 100));
  const [setupFeeBrl, setSetupFeeBrl] = useState(String(order.setupFeeBrlCents / 100));
  const [durationDays, setDurationDays] = useState(String(order.durationDays));
  const [campaignType, setCampaignType] = useState(order.campaignType);
  const [objective, setObjective] = useState(order.objective);
  const [reason, setReason] = useState("");

  const extraCreativesBrlCents = deriveExtraCreativesBrlCents(order);
  const nextTotalBrlCents =
    billedAdBudgetBrlCents({ adBudgetBrlCents: brlInputToCents(adBudgetBrl), adBudgetPaidToMeta: order.adBudgetPaidToMeta }) +
    brlInputToCents(serviceFeeBrl) +
    brlInputToCents(setupFeeBrl) +
    extraCreativesBrlCents;
  const isLandingTotalChanged = Boolean(order.pendingPurchaseId) && nextTotalBrlCents !== order.totalBrlCents;

  function handleSave() {
    correctValues.mutate(
      {
        orderId: order.id,
        adBudgetBrlCents: brlInputToCents(adBudgetBrl),
        serviceFeeBrlCents: brlInputToCents(serviceFeeBrl),
        setupFeeBrlCents: brlInputToCents(setupFeeBrl),
        durationDays: Number(durationDays) || order.durationDays,
        campaignType,
        objective,
        reason,
      },
      {
        onSuccess: ({ financeNotes }) => {
          toast.success(`Valores do ${order.code} corrigidos.`);
          for (const note of financeNotes) toast.info(note);
          onClose();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(isOpenNow) => !isOpenNow && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corrigir valores · {order.code}</DialogTitle>
          <DialogDescription>
            Vale só antes de a campanha ir ao ar. Fica registrado no histórico do pedido.
          </DialogDescription>
        </DialogHeader>

        <SettingsGrid>
          <SettingsField label="Verba do anúncio (R$)">
            <Input inputMode="decimal" value={adBudgetBrl} onChange={(event) => setAdBudgetBrl(event.target.value)} />
          </SettingsField>
          <SettingsField label="Taxa de serviço (R$)">
            <Input inputMode="decimal" value={serviceFeeBrl} onChange={(event) => setServiceFeeBrl(event.target.value)} />
          </SettingsField>
          <SettingsField label="Setup (R$)">
            <Input inputMode="decimal" value={setupFeeBrl} onChange={(event) => setSetupFeeBrl(event.target.value)} />
          </SettingsField>
          <SettingsField label="Duração (dias)">
            <Input inputMode="numeric" value={durationDays} onChange={(event) => setDurationDays(event.target.value)} />
          </SettingsField>
          <SettingsField label="Tipo de campanha" wide>
            <div className="flex flex-wrap gap-1.5">
              {CAMPAIGN_TYPES_BY_PLATFORM[order.platform].map((type) => (
                <ChoiceChip key={type} isOn={campaignType === type} onClick={() => setCampaignType(type)}>
                  {CAMPAIGN_TYPE_SHORT_LABEL[type]}
                </ChoiceChip>
              ))}
            </div>
          </SettingsField>
          <SettingsField label="Objetivo" wide>
            <div className="flex flex-wrap gap-1.5">
              {OBJECTIVES_BY_PLATFORM[order.platform].map((option) => (
                <ChoiceChip key={option} isOn={objective === option} onClick={() => setObjective(option)}>
                  {OBJECTIVE_LABEL[option]}
                </ChoiceChip>
              ))}
            </div>
          </SettingsField>
          <SettingsField label="Motivo da correção" wide>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              placeholder="Ex.: pedido avulso digitado com verba errada"
            />
          </SettingsField>
          <SettingsNotice tone={isLandingTotalChanged ? "warn" : "info"}>
            Total: {formatBrlFromCents(order.totalBrlCents)} → {formatBrlFromCents(nextTotalBrlCents)}
            {extraCreativesBrlCents > 0 && ` (inclui ${formatBrlFromCents(extraCreativesBrlCents)} de criativos extras)`}
            {isLandingTotalChanged && ". Pedido pago pela landing: mantenha o total cobrado."}
          </SettingsNotice>
        </SettingsGrid>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={correctValues.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={correctValues.isPending || reason.trim().length < 3}>
            {correctValues.isPending && <OrbitaSpinner className="mr-1.5 size-4" />}
            Salvar correção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
