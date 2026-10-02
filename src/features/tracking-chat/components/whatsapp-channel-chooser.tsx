"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertTriangle, BadgeCheck, QrCode, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import { ConnectNumberWizard } from "@/features/campanhas/components/self-service/connect-number-wizard";
import { useCreateOfficialTracking } from "@/features/campanhas/hooks/use-official-number";

const NO_TRACKING_KEY = "sem-funil";
const DISMISSED_STORAGE_KEY = "orbita:whatsapp-chooser-dismissed";

function readDismissedKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(DISMISSED_STORAGE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissedKeys(keys: Set<string>) {
  try {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(Array.from(keys)));
  } catch {
    // sem storage (aba anônima): volta a valer só para a visita
  }
}

/**
 * Primeira entrada no chat sem nenhum WhatsApp no funil (ou empresa sem funil nenhum): o cliente escolhe
 * entre conectar por QR Code (Uazapi) ou o número oficial (API da Meta),
 * sabendo o risco de cada um — em vez de cair numa lista vazia sem saber o que fazer.
 */
export function WhatsAppChannelChooser({ trackingId }: { trackingId: string | null }) {
  const router = useRouter();
  const createTracking = useCreateOfficialTracking();
  const { instance, instanceLoading } = useQueryInstances(trackingId ?? "", { enabled: Boolean(trackingId) });
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => readDismissedKeys());
  const [wizardTrackingId, setWizardTrackingId] = useState<string | null>(null);

  const dismissKey = trackingId ?? NO_TRACKING_KEY;
  // "Decidir depois" vale para sempre neste navegador e funil: o aviso não volta a cada visita ao chat.
  const isDismissed = dismissedKeys.has(dismissKey);
  // Instância criada mas nunca ligada a um número também conta como "sem WhatsApp".
  const hasNumber = Boolean(instance && (instance.status === "CONNECTED" || instance.phoneNumber));
  const isLoading = Boolean(trackingId) && instanceLoading;
  const isOpen = !isLoading && !hasNumber && !isDismissed && !wizardTrackingId;

  function dismiss() {
    const nextKeys = new Set(dismissedKeys).add(dismissKey);
    setDismissedKeys(nextKeys);
    saveDismissedKeys(nextKeys);
  }

  /** Empresa sem funil: cria um na hora, com o nome do canal escolhido. */
  function withTracking(trackingName: string, onReady: (readyTrackingId: string) => void) {
    if (trackingId) return onReady(trackingId);
    createTracking.mutate(
      { name: trackingName, description: "Conversas do WhatsApp" },
      {
        onSuccess: (created) => onReady(created.trackingId),
        onError: (error) => toast.error(error.message || "Não foi possível criar o funil."),
      },
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && dismiss()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conecte seu WhatsApp para começar a conversar</DialogTitle>
            <DialogDescription>
              {trackingId ? "Este funil ainda não tem nenhum número conectado." : "Sua empresa ainda não tem nenhum WhatsApp conectado."} Escolha como quer conectar — dá para trocar depois nas configurações.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-muted-foreground" />
                <p className="font-semibold">WhatsApp por QR Code</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Usa o número que você já tem no celular: é só ler um QR Code. Rápido de conectar.
              </p>
              <p className="flex items-start gap-2 rounded-md bg-warning/10 p-2 text-xs text-warning dark:text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Alto risco de bloqueio pela Meta, principalmente se enviar muitas mensagens ou disparos.
              </p>
              <Button
                variant="outline"
                className="mt-auto"
                disabled={createTracking.isPending}
                onClick={() =>
                  withTracking("WhatsApp", (readyTrackingId) => {
                    dismiss();
                    router.push(`/tracking/${readyTrackingId}/settings?tab=instance&create=uazapi`);
                  })
                }
              >
                Conectar por QR Code
              </Button>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-success/60 bg-success/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-5 text-success" />
                  <p className="font-semibold">API Oficial da Meta</p>
                </div>
                <Badge className="bg-success text-white">Recomendado</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Número oficial do WhatsApp Business, liberado para disparos em massa. A gente guia cada tela da Meta.
              </p>
              <p className="flex items-start gap-2 rounded-md bg-success/10 p-2 text-xs text-success dark:text-success">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                Menos risco de banimento. Precisa de um número novo, que não esteja no aplicativo do WhatsApp.
              </p>
              <Button
                className="mt-auto bg-success text-white hover:bg-success"
                disabled={createTracking.isPending}
                onClick={() => withTracking("WhatsApp Oficial", setWizardTrackingId)}
              >
                Conectar número oficial
              </Button>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="justify-self-center text-muted-foreground" onClick={dismiss}>
            Decidir depois
          </Button>
        </DialogContent>
      </Dialog>

      {wizardTrackingId && (
        <ConnectNumberWizard
          trackingId={wizardTrackingId}
          open
          onOpenChange={(open) => {
            if (open) return;
            setWizardTrackingId(null);
            dismiss();
          }}
        />
      )}
    </>
  );
}
