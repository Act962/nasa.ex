"use client";

import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { phoneMaskFull } from "@/utils/format-phone";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import {
  usePaymentMessagingSender,
  useSetPaymentMessagingSender,
} from "@/features/payment/hooks/use-payment-messaging";

// Spec 0115: qual tracking (número de WhatsApp) envia a régua e os lembretes do financeiro.

const AUTOMATIC_VALUE = "automatic";

const PROVIDER_LABELS = {
  UAZAPI:     "QR Code",
  META_CLOUD: "API oficial",
} as const;

export function MessagingSenderSelect() {
  const { data, isLoading } = usePaymentMessagingSender();
  const setSender = useSetPaymentMessagingSender();

  if (isLoading || !data) return null;

  const { options, selectedTrackingId, fallbackTrackingId } = data;
  const selectedOption = options.find((option) => option.trackingId === selectedTrackingId);
  const fallbackOption = options.find((option) => option.trackingId === fallbackTrackingId);

  function handleChange(value: string) {
    const trackingId = value === AUTOMATIC_VALUE ? null : value;
    setSender.mutate(
      { trackingId },
      {
        onSuccess: () => toast.success("Número das cobranças atualizado"),
        onError: (error) => toast.error(error.message ?? "Erro ao salvar"),
      },
    );
  }

  return (
    <Card className="gap-2 p-4" data-guide={GUIDE_ANCHORS.paymentMessagingSender.id}>
      <div>
        <Label className="text-sm font-semibold">Número que envia as cobranças</Label>
        <p className="text-xs text-muted-foreground">
          A régua, os lembretes e os avisos fiscais saem pelo WhatsApp deste tracking. A resposta
          do cliente cai no chat dele, com as automações que ele já tem.
        </p>
      </div>

      {options.length === 0 ? (
        <p className="text-xs text-warning">
          Nenhum tracking tem WhatsApp conectado. Conecte um número em um tracking para a régua
          enviar por WhatsApp.
        </p>
      ) : (
        <Select
          value={selectedTrackingId ?? AUTOMATIC_VALUE}
          onValueChange={handleChange}
          disabled={setSender.isPending}
        >
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTOMATIC_VALUE} className="text-xs">
              Automático (número mais antigo conectado)
            </SelectItem>
            {options.map((option) => (
              <SelectItem key={option.trackingId} value={option.trackingId} className="text-xs">
                {option.trackingName}
                {option.phoneNumber ? ` · ${phoneMaskFull(option.phoneNumber)}` : ""}
                {` · ${PROVIDER_LABELS[option.provider]}`}
                {option.isConnected ? "" : " (desconectado)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!selectedTrackingId && fallbackOption && (
        <p className="text-[11px] text-muted-foreground">Hoje sai por: {fallbackOption.trackingName}.</p>
      )}
      {selectedOption && !selectedOption.isConnected && (
        <p className="text-[11px] text-warning">
          Este número está desconectado: os avisos por WhatsApp vão falhar até ele ser reconectado.
        </p>
      )}
      {selectedOption?.provider === "META_CLOUD" && (
        <p className="text-[11px] text-muted-foreground">
          Na API oficial, mensagem livre só chega se o cliente falou com você nas últimas 24h.
        </p>
      )}
    </Card>
  );
}
