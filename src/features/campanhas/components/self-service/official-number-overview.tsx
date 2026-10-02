"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { useSendingNumbers } from "../../hooks/use-sending-numbers";
import { useCreateOfficialTracking } from "../../hooks/use-official-number";
import { ConnectNumberIntro } from "./connect-number-intro";
import { ConnectNumberWizard } from "./connect-number-wizard";
import { MetaNumberPanel } from "./meta-number-panel";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

const OFFICIAL_TRACKING_NAME = "WhatsApp Oficial";

/** Disparado por outras telas (ex.: "Nova campanha" sem número) para abrir a conexão. */
export const CONNECT_NUMBER_EVENT = "campanhas:connect-number";

/** Topo do app Campanhas (spec 0040): painel do número ou convite para conectar. */
export function OfficialNumberOverview({
  activeTrackingId,
  onActiveTrackingChange,
  isIntroVisible,
}: {
  activeTrackingId: string | null;
  onActiveTrackingChange: (trackingId: string) => void;
  /** Aba "Como funciona?": benefícios, custos e passo a passo. */
  isIntroVisible: boolean;
}) {
  const { data: numbers, isLoading } = useSendingNumbers();
  const { trackings } = useQueryTrackings();
  const [wizardTrackingId, setWizardTrackingId] = useState<string | null>(null);
  const createTracking = useCreateOfficialTracking();
  const startConnectionRef = useRef<() => void>(() => {});

  function startWithNewTracking() {
    createTracking.mutate(
      { name: OFFICIAL_TRACKING_NAME, description: "Respostas do WhatsApp oficial e dos disparos em massa" },
      {
        onSuccess: (created) => setWizardTrackingId(created.trackingId),
        onError: (error) => toast.error(error.message || "Não foi possível criar o funil."),
      },
    );
  }

  // Conectar primeiro, escolher funil depois: usa o funil próprio do WhatsApp Oficial (cria se ainda não existe).
  function connectOfficialNumber() {
    const officialTracking = trackings.find((tracking) => tracking.name === OFFICIAL_TRACKING_NAME);
    if (officialTracking) return setWizardTrackingId(officialTracking.id);
    startWithNewTracking();
  }

  startConnectionRef.current = connectOfficialNumber;

  useEffect(() => {
    const handleConnectRequest = () => startConnectionRef.current();
    window.addEventListener(CONNECT_NUMBER_EVENT, handleConnectRequest);
    return () => window.removeEventListener(CONNECT_NUMBER_EVENT, handleConnectRequest);
  }, []);

  if (isLoading) return null;
  const hasNumbers = Boolean(numbers?.length);
  const activePanelTrackingId = activeTrackingId;

  return (
    <div className="space-y-3">
      {hasNumbers ? (
        <>
          {numbers && numbers.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {numbers.map((number) => (
                <Button
                  key={number.trackingId}
                  size="sm"
                  variant={number.trackingId === activePanelTrackingId ? "secondary" : "ghost"}
                  onClick={() => onActiveTrackingChange(number.trackingId)}
                >
                  {number.trackingName}
                </Button>
              ))}
            </div>
          )}
          {activePanelTrackingId && (
            <MetaNumberPanel trackingId={activePanelTrackingId} isCompact onContinueSetup={() => setWizardTrackingId(activePanelTrackingId)} />
          )}
        </>
      ) : null}

      {isIntroVisible && (
        <div data-guide={GUIDE_ANCHORS.officialNumberBanner.id}>
          <ConnectNumberIntro />
        </div>
      )}

      {wizardTrackingId && (
        <ConnectNumberWizard
          trackingId={wizardTrackingId}
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setWizardTrackingId(null);
          }}
        />
      )}
    </div>
  );
}
