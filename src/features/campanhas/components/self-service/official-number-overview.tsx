"use client";

import { useState } from "react";
import { BookOpen, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { useSendingNumbers } from "../../hooks/use-sending-numbers";
import { BeforeYouStart } from "./before-you-start";
import { ConnectNumberWizard } from "./connect-number-wizard";
import { MetaNumberPanel } from "./meta-number-panel";

/** Topo do app Campanhas (spec 0040): painel do número ou convite para conectar. */
export function OfficialNumberOverview() {
  const { data: numbers, isLoading } = useSendingNumbers();
  const { trackings } = useQueryTrackings();
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [wizardTrackingId, setWizardTrackingId] = useState<string | null>(null);
  const [selectedTrackingId, setSelectedTrackingId] = useState("");
  const [panelTrackingId, setPanelTrackingId] = useState<string | null>(null);

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
          {activePanelTrackingId && <MetaNumberPanel trackingId={activePanelTrackingId} />}
        </>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-amber-500" /> Conecte um número oficial para disparar
          </p>
          <p className="text-sm text-muted-foreground">
            Escolha o tracking que vai disparar. Você traz seu número ou compra um aqui, conecta à Meta e cadastra o cartão.
          </p>
          {trackings.length === 0 && (
            <p className="text-xs text-muted-foreground">Você não participa de nenhum tracking. Peça ao dono da empresa para te incluir.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTrackingId}
              onChange={(event) => setSelectedTrackingId(event.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Escolha o tracking</option>
              {trackings.map((tracking) => (
                <option key={tracking.id} value={tracking.id}>
                  {tracking.name}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={!selectedTrackingId} onClick={() => setWizardTrackingId(selectedTrackingId)}>
              Conectar número oficial
            </Button>
          </div>
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
