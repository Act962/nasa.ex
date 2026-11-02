"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSetCampaignDelivery } from "@/features/trafego/hooks/use-trafego-campaign-builder";

/**
 * Liga/desliga de conjunto ou anúncio no cartão (spec 0126). Pausar é direto; ativar
 * pede confirmação porque a Meta volta a gastar a verba. Sem permissão, só mostra o estado.
 */
export function DeliveryToggle({
  orderId,
  objectType,
  objectId,
  objectName,
  isActive,
  canEdit,
}: {
  orderId: string;
  objectType: "adset" | "ad";
  objectId: string;
  objectName: string;
  isActive: boolean;
  canEdit: boolean;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const setDelivery = useSetCampaignDelivery();
  const kindLabel = objectType === "adset" ? "conjunto de anúncios" : "anúncio";

  function apply(nextIsActive: boolean) {
    setDelivery.mutate(
      { orderId, objectType, objectId, isActive: nextIsActive },
      {
        onSuccess: () => toast.success(nextIsActive ? "Ativado na Meta." : "Pausado na Meta."),
        onError: (error) => toast.error(error.message),
        onSettled: () => setIsConfirmOpen(false),
      },
    );
  }

  return (
    // O cartão inteiro é um link: o clique no botão não pode navegar.
    <span className="relative z-10 inline-flex" onClick={(event) => event.stopPropagation()}>
      <Switch
        checked={isActive}
        disabled={!canEdit || setDelivery.isPending}
        aria-label={`${isActive ? "Pausar" : "Ativar"} ${kindLabel} ${objectName}`}
        title={canEdit ? undefined : "Só o dono ou um administrador da empresa pode pausar e ativar."}
        onCheckedChange={(nextIsActive) => (nextIsActive ? setIsConfirmOpen(true) : apply(false))}
      />
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={`Ativar ${kindLabel}?`}
        description={`"${objectName}" volta a rodar e a Meta volta a gastar a verba.`}
        confirmText="Ativar"
        onConfirm={() => apply(true)}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={setDelivery.isPending}
      />
    </span>
  );
}
