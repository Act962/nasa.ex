"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { useSendingNumbers } from "../../hooks/use-sending-numbers";
import { useCreateOfficialTracking } from "../../hooks/use-official-number";
import { BeforeYouStart } from "./before-you-start";
import { ConnectNumberWizard } from "./connect-number-wizard";
import { MetaNumberPanel } from "./meta-number-panel";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

const OFFICIAL_TRACKING_NAME = "WhatsApp Oficial";

/** Disparado por outras telas (ex.: "Nova campanha" sem número) para abrir a conexão. */
export const CONNECT_NUMBER_EVENT = "campanhas:connect-number";

/** Topo do app Campanhas (spec 0040): painel do número ou convite para conectar. */
export function OfficialNumberOverview() {
  const { data: numbers, isLoading } = useSendingNumbers();
  const { trackings } = useQueryTrackings();
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [wizardTrackingId, setWizardTrackingId] = useState<string | null>(null);
  const [selectedTrackingId, setSelectedTrackingId] = useState("");
  const [panelTrackingId, setPanelTrackingId] = useState<string | null>(null);
  const createTracking = useCreateOfficialTracking();
  const [isHighlighted, setIsHighlighted] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
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

  startConnectionRef.current = () => {
    if (trackings.length === 0) return startWithNewTracking();
    if (trackings.length === 1) return setWizardTrackingId(trackings[0].id);
    bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setIsHighlighted(true);
    setTimeout(() => setIsHighlighted(false), 2_400);
  };

  useEffect(() => {
    const handleConnectRequest = () => startConnectionRef.current();
    window.addEventListener(CONNECT_NUMBER_EVENT, handleConnectRequest);
    return () => window.removeEventListener(CONNECT_NUMBER_EVENT, handleConnectRequest);
  }, []);

  const effectiveTrackingId = selectedTrackingId || (trackings.length === 1 ? trackings[0].id : "");

  if (isLoading) return null;
  const hasNumbers = Boolean(numbers?.length);
  const activePanelTrackingId = panelTrackingId ?? numbers?.[0]?.trackingId ?? null;

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
                  onClick={() => setPanelTrackingId(number.trackingId)}
                >
                  {number.trackingName}
                </Button>
              ))}
            </div>
          )}
          {activePanelTrackingId && (
            <MetaNumberPanel trackingId={activePanelTrackingId} onContinueSetup={() => setWizardTrackingId(activePanelTrackingId)} />
          )}
        </>
      ) : (
        <div
          ref={bannerRef}
          data-guide={GUIDE_ANCHORS.officialNumberBanner.id}
          className={cn(
            "flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 transition-shadow duration-500",
            isHighlighted && "shadow-[0_0_0_4px] shadow-amber-500/40",
          )}
        >
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-amber-500" /> Conecte seu WhatsApp oficial para disparar
          </p>
          {trackings.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                A gente cria o funil onde as respostas dos clientes vão chegar e te guia para conectar o número. Leva uns 10
                minutos.
              </p>
              <Button size="sm" className="w-fit" onClick={startWithNewTracking} disabled={createTracking.isPending}>
                {createTracking.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Preparando seu funil…
                  </>
                ) : (
                  "Começar"
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Escolha o funil (tracking) onde as respostas dos clientes vão chegar. Você traz seu número ou compra um aqui,
                conecta à Meta e cadastra o cartão.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={effectiveTrackingId}
                  onChange={(event) => setSelectedTrackingId(event.target.value)}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Escolha o funil</option>
                  {trackings.map((tracking) => (
                    <option key={tracking.id} value={tracking.id}>
                      {tracking.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!effectiveTrackingId}
                  onClick={() => setWizardTrackingId(effectiveTrackingId)}
                >
                  Conectar número oficial
                </Button>
                <Button size="sm" variant="ghost" onClick={startWithNewTracking} disabled={createTracking.isPending}>
                  ou criar um funil só para o WhatsApp
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setIsGuideOpen(true)}>
        <BookOpen className="size-4" /> Como funciona e quanto custa
      </Button>

      {wizardTrackingId && (
        <ConnectNumberWizard
          trackingId={wizardTrackingId}
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setWizardTrackingId(null);
          }}
        />
      )}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Antes de começar</DialogTitle>
          </DialogHeader>
          <BeforeYouStart trackingId={activePanelTrackingId} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
