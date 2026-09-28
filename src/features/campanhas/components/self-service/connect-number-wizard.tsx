"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Phone, ShoppingCart, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { WhatsAppEmbeddedSignupButton } from "@/features/tracking-settings/components/whatsapp-embedded-signup-button";
import { metaPaymentMethodsUrl } from "../../lib/meta-links";
import { useBuySalvyNumber, useMetaNumberPanel, useSalvyLatestCode, useSalvyNumberOffer } from "../../hooks/use-official-number";
import { CopyField } from "./copy-field";
import { MetaNumberPanel } from "./meta-number-panel";
import { RequestTeamHelp } from "./request-team-help";
import { buildCardChecklist, buildMetaChecklist } from "./connect-steps-content";
import { ChecklistProgress, GuidedChecklist } from "./guided-checklist";

const STEPS = [
  { id: "number", label: "Número" },
  { id: "meta", label: "Meta" },
  { id: "card", label: "Cartão" },
  { id: "done", label: "Pronto" },
] as const;

const OWN_NUMBER_CHECKLIST = [
  "Não está em uso em outro WhatsApp (nem no app comum, nem no Business)",
  "Recebe SMS ou ligação para o código de verificação",
  "É um número da empresa, que vai continuar ativo",
];

type NumberSource = "own" | "salvy";

function Stepper({ currentIndex }: { currentIndex: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-all duration-300",
                isDone && "border-emerald-500 bg-emerald-500 text-white",
                isCurrent && "scale-110 border-emerald-500 text-emerald-600",
              )}
            >
              {isDone ? <Check className="size-4 animate-in zoom-in" /> : index + 1}
            </span>
            <span className={cn("hidden text-xs sm:inline", !isCurrent && "text-muted-foreground")}>{step.label}</span>
            {index < STEPS.length - 1 && (
              <span className={cn("h-px flex-1 transition-colors duration-500", isDone ? "bg-emerald-500" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SalvyPurchase({ trackingId, onBought }: { trackingId: string; onBought: (numberId: string, phoneNumber: string) => void }) {
  const { data: offer, isLoading } = useSalvyNumberOffer();
  const buyNumber = useBuySalvyNumber();
  const [areaCode, setAreaCode] = useState<number | null>(null);

  if (isLoading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (!offer?.isAvailable) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        A compra de números ainda não está liberada na sua conta. Peça ajuda à equipe que a gente providencia.
      </p>
    );
  }

  function buy() {
    if (!areaCode) return;
    buyNumber.mutate(
      { areaCode, trackingId },
      {
        onSuccess: (number) => {
          toast.success(`Número ${number.phoneNumber} comprado!`);
          onBought(number.id, number.phoneNumber);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Número móvel virtual, pronto para o WhatsApp oficial. Custa <strong>{offer.monthlyStars} Stars por mês</strong>, cobrados do saldo da empresa.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={areaCode ?? ""}
          onChange={(event) => setAreaCode(Number(event.target.value) || null)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Escolha o DDD</option>
          {offer.areaCodes.map((code) => (
            <option key={code} value={code}>
              DDD {code}
            </option>
          ))}
        </select>
        <Button onClick={buy} disabled={!areaCode || buyNumber.isPending}>
          {buyNumber.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />} Comprar número
        </Button>
      </div>
    </div>
  );
}

function LiveSmsCode({ numberId }: { numberId: string }) {
  const { data: latestCode } = useSalvyLatestCode(numberId);
  if (!latestCode) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Esperando o SMS da Meta chegar no seu número…
      </p>
    );
  }
  return <CopyField label="Código que chegou por SMS — cole no pop-up da Meta" value={latestCode.code} isHighlighted />;
}

const PROGRESS_KEY_PREFIX = "campanhas:connect-wizard:";

function loadProgress(trackingId: string): Set<string> {
  try {
    const stored = localStorage.getItem(`${PROGRESS_KEY_PREFIX}${trackingId}`);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveProgress(trackingId: string, doneIds: Set<string>) {
  try {
    localStorage.setItem(`${PROGRESS_KEY_PREFIX}${trackingId}`, JSON.stringify([...doneIds]));
  } catch {
    // Sem storage (aba anônima): o progresso só vale nesta sessão.
  }
}

/** Assistente "Conectar número oficial" (spec 0040, RF-3). */
export function ConnectNumberWizard({ trackingId, open, onOpenChange }: { trackingId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [numberSource, setNumberSource] = useState<NumberSource | null>(null);
  const [isChecklistConfirmed, setIsChecklistConfirmed] = useState(false);
  const [salvyNumber, setSalvyNumber] = useState<{ id: string; phoneNumber: string } | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(() => loadProgress(trackingId));
  const [isConnectedNow, setIsConnectedNow] = useState(false);
  const { data: panel } = useMetaNumberPanel(trackingId, { enabled: open && stepIndex >= 1 });

  useEffect(() => saveProgress(trackingId, doneIds), [trackingId, doneIds]);

  const isEmbeddedSignupConfigured = Boolean(process.env.NEXT_PUBLIC_META_APP_ID && process.env.NEXT_PUBLIC_META_LOGIN_CONFIG_ID);
  const canLeaveNumberStep = (numberSource === "own" && isChecklistConfirmed) || (numberSource === "salvy" && salvyNumber);
  const paymentMethodsUrl = panel?.links.paymentMethods ?? metaPaymentMethodsUrl({});
  const isConnected = isConnectedNow || Boolean(panel?.phone);

  const markDone = (id: string) => setDoneIds((current) => new Set(current).add(id));
  const undo = (id: string) =>
    setDoneIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });

  const metaItems = buildMetaChecklist({
    isConnected,
    isEmbeddedSignupConfigured,
    connectAction: isEmbeddedSignupConfigured ? (
      <WhatsAppEmbeddedSignupButton
        trackingId={trackingId}
        onSuccess={() => {
          setIsConnectedNow(true);
          toast.success("Número conectado à Meta!");
        }}
      />
    ) : (
      <div className="space-y-1 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <p>1. Clique em &quot;Pedir ajuda à equipe&quot;, aqui embaixo.</p>
        <p>2. A gente te chama e conecta o número com você.</p>
        <p>3. Quando avisarmos que está pronto, clique em &quot;Já fiz&quot;.</p>
      </div>
    ),
    smsCode: salvyNumber ? <LiveSmsCode numberId={salvyNumber.id} /> : null,
  }).map((item) => (item.id === "whatsapp" && !isEmbeddedSignupConfigured ? { ...item, isManualDoneHidden: false } : item));
  const cardItems = buildCardChecklist({ paymentMethodsUrl });
  const isItemDone = (item: { id: string; isAutoDone?: boolean }) => doneIds.has(item.id) || Boolean(item.isAutoDone);
  const isMetaDone = metaItems.every(isItemDone);
  const isCardDone = cardItems.every(isItemDone);

  const allItems = [...metaItems, ...cardItems];
  const overallDone = (canLeaveNumberStep || stepIndex > 0 ? 1 : 0) + allItems.filter(isItemDone).length + (stepIndex === 3 ? 1 : 0);
  const overallTotal = 2 + allItems.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conectar número oficial</DialogTitle>
          <DialogDescription>Uns 10 minutos. A gente mostra onde clicar em cada tela e guarda seu progresso.</DialogDescription>
        </DialogHeader>

        <Stepper currentIndex={stepIndex} />
        <ChecklistProgress doneCount={overallDone} total={overallTotal} label="Sua configuração" />

        <div key={stepIndex} className="animate-in fade-in slide-in-from-right-4 min-w-0 space-y-4 duration-300">
          {stepIndex === 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { source: "own", icon: Smartphone, title: "Tenho um número", text: "Uso um chip da empresa." },
                  { source: "salvy", icon: ShoppingCart, title: "Comprar número", text: "Pronto na hora, pago em Stars." },
                ] as const).map((option) => (
                  <button
                    key={option.source}
                    type="button"
                    onClick={() => setNumberSource(option.source)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all hover:border-emerald-500/60",
                      numberSource === option.source && "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500",
                    )}
                  >
                    <option.icon className="mb-2 size-5 text-emerald-600" />
                    <p className="font-medium">{option.title}</p>
                    <p className="text-xs text-muted-foreground">{option.text}</p>
                  </button>
                ))}
              </div>

              {numberSource === "own" && (
                <div className="space-y-2 rounded-lg border p-3">
                  {OWN_NUMBER_CHECKLIST.map((item) => (
                    <p key={item} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {item}
                    </p>
                  ))}
                  <label className="flex items-center gap-2 pt-1 text-sm font-medium">
                    <Checkbox checked={isChecklistConfirmed} onCheckedChange={(checked) => setIsChecklistConfirmed(checked === true)} />
                    Meu número atende a tudo isso
                  </label>
                </div>
              )}

              {numberSource === "salvy" &&
                (salvyNumber ? (
                  <CopyField label="Seu número novo — use no pop-up da Meta" value={salvyNumber.phoneNumber} />
                ) : (
                  <SalvyPurchase trackingId={trackingId} onBought={(id, phoneNumber) => setSalvyNumber({ id, phoneNumber })} />
                ))}
            </>
          )}

          {stepIndex === 1 && (
            <>
              <p className="text-sm text-muted-foreground">
                Siga os passos na ordem. Cada link abre numa aba nova — depois é só voltar aqui e marcar o que já fez.
              </p>
              <GuidedChecklist items={metaItems} doneIds={doneIds} onMarkDone={markDone} onUndo={undo} />
            </>
          )}

          {stepIndex === 2 && <GuidedChecklist items={cardItems} doneIds={doneIds} onMarkDone={markDone} onUndo={undo} />}

          {stepIndex === 3 && (
            <>
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <Phone className="size-4" /> Tudo pronto! Este é o seu número oficial:
              </p>
              <MetaNumberPanel trackingId={trackingId} />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <RequestTeamHelp step={`Conectar número — ${STEPS[stepIndex].label}`} />
          <div className="flex gap-2">
            {stepIndex > 0 && stepIndex < 3 && (
              <Button variant="ghost" onClick={() => setStepIndex(stepIndex - 1)}>
                Voltar
              </Button>
            )}
            {stepIndex === 0 && (
              <Button onClick={() => setStepIndex(1)} disabled={!canLeaveNumberStep}>
                Continuar
              </Button>
            )}
            {stepIndex === 1 && (
              <Button onClick={() => setStepIndex(2)} disabled={!isMetaDone}>
                Continuar
              </Button>
            )}
            {stepIndex === 2 && (
              <Button onClick={() => setStepIndex(3)} disabled={!isCardDone}>
                Continuar
              </Button>
            )}
            {stepIndex === 3 && <Button onClick={() => onOpenChange(false)}>Concluir</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
