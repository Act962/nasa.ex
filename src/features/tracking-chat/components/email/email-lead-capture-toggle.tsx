"use client";

import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useEmailLeadCapture, useSetEmailLeadCapture } from "@/features/tracking-chat/hooks/use-tracking-chat-email";

// Spec 0045: remetente novo na caixa da empresa vira lead neste funil (um funil por empresa).
export function EmailLeadCaptureToggle({ trackingId }: { trackingId: string }) {
  const captureQuery = useEmailLeadCapture();
  const setCapture = useSetEmailLeadCapture();
  const captureTrackingId = captureQuery.data?.trackingId ?? null;
  const isEnabledHere = captureTrackingId === trackingId;
  const isEnabledElsewhere = Boolean(captureTrackingId) && !isEnabledHere;

  const handleChange = (isEnabled: boolean) => {
    setCapture.mutate(
      { trackingId, isEnabled },
      {
        onSuccess: (result) => {
          if (!isEnabled) return toast.success("Novos remetentes não viram mais lead neste funil.");
          toast.success(
            result.createdLeads > 0
              ? `Ligado. ${result.createdLeads} remetente(s) novo(s) das últimas 24 h já viraram lead aqui.`
              : "Ligado. Novos remetentes da caixa viram lead neste funil em até 5 minutos.",
          );
        },
        onError: (error) => toast.error(error.message || "Não foi possível mudar a captura."),
      },
    );
  };

  return (
    <label className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
      <UserPlus className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium">Novos remetentes viram lead aqui</span>
        <span className="block text-[11px] text-muted-foreground">
          {isEnabledElsewhere
            ? "Ligado em outro funil — ligar aqui move o destino."
            : "E-mail de quem ainda não é lead cria o lead neste funil (aba Principal, a cada 5 min)."}
        </span>
      </span>
      <Switch
        checked={isEnabledHere}
        disabled={captureQuery.isLoading || setCapture.isPending}
        onCheckedChange={handleChange}
      />
    </label>
  );
}
