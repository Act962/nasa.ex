"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, Copy, Laptop, Phone, ShoppingCart, Smartphone } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { WhatsAppEmbeddedSignupButton } from "@/features/tracking-settings/components/whatsapp-embedded-signup-button";
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";
import { metaPaymentMethodsUrl } from "../../lib/meta-links";
import { useMetaNumberPanel, useNotifyNumberPurchaseInterest, useSalvyNumbers } from "../../hooks/use-official-number";
import { buildNumberPurchaseWhatsAppUrl } from "../../lib/number-purchase-contact";
import { CopyField } from "@/features/meta-guide/components/copy-field";
import { MetaNumberPanel } from "./meta-number-panel";
import { RequestTeamHelp } from "./request-team-help";
import { buildCardChecklist } from "./connect-steps-content";
import { ChecklistProgress, GuidedChecklist } from "./guided-checklist";
import { MetaGuideStepper } from "@/features/meta-guide/components/meta-guide-stepper";
import { LiveSmsCode, OWN_NUMBER_CHECKLIST, STEPS, Stepper, type NumberSource } from "./wizard-parts";
import { MetaKeysForm } from "./meta-keys-form";
import { NumberSetup } from "./number-setup";
import { useConnectProgress, useMetaSetupStatus, useSaveConnectProgress } from "../../hooks/use-meta-setup";
import { GUIDE_STEPS, WHATSAPP_GUIDE } from "../../lib/whatsapp-connect-guide";
import { KeyDraftField } from "./key-draft-field";
import { SpaceJourney } from "@/features/space-journey";
import { buildConnectJourneyStops } from "../../lib/connect-journey";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

const NUMBER_STEP_ID = "number";
/** Título do popup fora da etapa Meta (nela, é o passo atual). */
const STAGE_TITLES: Partial<Record<number, string>> = {
  0: "Escolha o número",
  2: "Cadastre o cartão na Meta",
  3: "Seu número oficial",
};
const META_DONE_ID = "meta-connected";
const CARD_STEP_IDS = ["open-billing", "add-card"];

/** Reabriu o assistente: volta para a primeira etapa ainda não concluída. */
function resumeStepIndex(doneIds: ReadonlySet<string>): number {
  if (!doneIds.has(NUMBER_STEP_ID)) return 0;
  if (!doneIds.has(META_DONE_ID)) return 1;
  if (!CARD_STEP_IDS.every((id) => doneIds.has(id))) return 2;
  return 3;
}

/** Passos que o cliente vê por padrão no guia (sem os que a ÓRBITA faz e sem o cartão). */
const DEFAULT_GUIDE_STEPS = GUIDE_STEPS.filter((step) => step.phase !== "payment" && !step.isAutomated);

/**
 * Assistente "Conectar número oficial" (spec 0040, RF-3/RF-11/RF-12/RF-14).
 * O progresso mora no banco: o cliente fecha, volta outro dia, em outro
 * aparelho, e continua do mesmo passo.
 */
const PRIMARY_STEP_BUTTON_CLASS =
  "rounded-full bg-brand-whatsapp! font-bold text-brand-whatsapp-deep! hover:bg-brand-whatsapp/90! max-sm:h-11 max-sm:px-6";

export function ConnectNumberWizard({ trackingId, open, onOpenChange }: { trackingId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: progress, isLoading } = useConnectProgress(trackingId, { enabled: open });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(92vh,860px)] flex-col overflow-hidden max-sm:h-[100dvh] max-sm:max-w-none max-sm:rounded-none max-sm:border-0 max-sm:p-4 sm:max-w-3xl lg:max-w-5xl"
        onInteractOutside={(event) => event.preventDefault()}
        data-guide={GUIDE_ANCHORS.officialNumberWizard.id}
      >
        {isLoading || !progress ? (
          <>
            <DialogTitle className="sr-only">Conectar número oficial</DialogTitle>
            <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <OrbitaSpinner className="size-4 " /> Carregando de onde você parou…
            </p>
          </>
        ) : (
          <WizardContent trackingId={trackingId} progress={progress} open={open} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  );
}

type ConnectProgress = NonNullable<ReturnType<typeof useConnectProgress>["data"]>;

function WizardContent({
  trackingId,
  progress,
  open,
  onOpenChange,
}: {
  trackingId: string;
  progress: ConnectProgress;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const saveProgress = useSaveConnectProgress();
  const { data: salvyNumbers } = useSalvyNumbers();
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set(progress.doneIds));
  const [stepIndex, setStepIndex] = useState(() => resumeStepIndex(new Set(progress.doneIds)));
  const isMobile = useIsMobile();
  const [isDesktopTipDismissed, setIsDesktopTipDismissed] = useState(false);
  // No celular, antes de começar: o passo a passo alterna entre a Meta e a ÓRBITA — no computador fica bem mais fácil.
  const isDesktopTipOpen = isMobile && stepIndex === 0 && !isDesktopTipDismissed;

  function copyLinkForComputer() {
    navigator.clipboard
      .writeText(`${window.location.origin}/campanhas`)
      .then(() => toast.success("Link copiado! Abra no computador e clique em Conectar número."))
      .catch(() => toast.info(`${window.location.origin}/campanhas`));
    setIsDesktopTipDismissed(true);
  }
  const [numberSource, setNumberSourceState] = useState<NumberSource | null>(progress.numberSource);
  const [isChecklistConfirmed, setIsChecklistConfirmed] = useState(progress.doneIds.includes(NUMBER_STEP_ID));
  const [isConnectedNow, setIsConnectedNow] = useState(false);
  const [guideStepTitle, setGuideStepTitle] = useState(
    () => (DEFAULT_GUIDE_STEPS.find((step) => step.slug === progress.guideSlug) ?? DEFAULT_GUIDE_STEPS[0])?.title ?? "Meta",
  );
  const [guideProgress, setGuideProgress] = useState(() => ({
    done: Math.max(0, DEFAULT_GUIDE_STEPS.findIndex((step) => step.slug === progress.guideSlug)),
    total: DEFAULT_GUIDE_STEPS.length,
  }));
  const savedSalvyNumber = salvyNumbers?.find((number) => number.id === progress.salvyNumberId);
  // Número já comprado em versões anteriores do assistente continua aparecendo para colar na Meta.
  const salvyNumber = savedSalvyNumber ? { id: savedSalvyNumber.id, phoneNumber: savedSalvyNumber.phoneNumber } : null;

  function persist(patch: Omit<Parameters<typeof saveProgress.mutate>[0], "trackingId">) {
    saveProgress.mutate({ trackingId, ...patch });
  }

  // Cliques rápidos em "Fiz, próximo": um envio por vez, sempre com o passo mais
  // recente — com o banco lento, envios paralelos gravavam um passo antigo por cima.
  const pendingGuideSlugRef = useRef<string | null>(null);
  const isSavingGuideSlugRef = useRef(false);
  const guideSlugTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function flushGuideSlug() {
    const guideSlug = pendingGuideSlugRef.current;
    if (!guideSlug || isSavingGuideSlugRef.current) return;
    pendingGuideSlugRef.current = null;
    isSavingGuideSlugRef.current = true;
    saveProgress
      .mutateAsync({ trackingId, guideSlug })
      .catch(() => undefined)
      .finally(() => {
        isSavingGuideSlugRef.current = false;
        flushGuideSlug();
      });
  }
  function persistGuideSlug(guideSlug: string) {
    pendingGuideSlugRef.current = guideSlug;
    clearTimeout(guideSlugTimerRef.current);
    guideSlugTimerRef.current = setTimeout(flushGuideSlug, 400);
  }
  useEffect(
    () => () => {
      clearTimeout(guideSlugTimerRef.current);
      flushGuideSlug();
    },
    // Só ao fechar: envia o passo que ainda estava esperando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function setNumberSource(source: NumberSource) {
    setNumberSourceState(source);
    persist({ numberSource: source });
  }
  const {
    data: panel,
    isLoading: isPanelLoading,
    isFetching: isPanelFetching,
    refetch: refetchPanel,
  } = useMetaNumberPanel(trackingId, { enabled: open && stepIndex >= 1 });
  const { data: setupStatus } = useMetaSetupStatus(trackingId, { enabled: open && (stepIndex === 1 || stepIndex === 2) });

  const isEmbeddedSignupConfigured = Boolean(process.env.NEXT_PUBLIC_META_APP_ID && process.env.NEXT_PUBLIC_META_LOGIN_CONFIG_ID);
  const canLeaveNumberStep = (numberSource === "own" && isChecklistConfirmed) || (numberSource === "salvy" && salvyNumber);
  const paymentMethodsUrl = panel?.links.paymentMethods ?? metaPaymentMethodsUrl({});
  const isConnected = isConnectedNow || Boolean(panel?.phone) || Boolean(setupStatus?.phone);
  // Número conectado não encerra o guia: ainda faltam webhook e publicar o app.
  const isGuideDone = doneIds.has(META_DONE_ID);

  const markDone = (id: string) => {
    setDoneIds((current) => new Set(current).add(id));
    persist({ addDoneIds: [id] });
  };
  const [isOwnNumberDialogOpen, setIsOwnNumberDialogOpen] = useState(false);
  const notifyNumberPurchase = useNotifyNumberPurchaseInterest();

  function chooseOwnNumber() {
    setNumberSource("own");
    setIsOwnNumberDialogOpen(true);
  }

  function confirmOwnNumber() {
    setIsChecklistConfirmed(true);
    setIsOwnNumberDialogOpen(false);
    markDone(NUMBER_STEP_ID);
    setStepIndex(1);
  }

  // Comprar número = conversa com o comercial: o cliente manda a mensagem pelo WhatsApp dele e a equipe recebe uma cópia.
  function requestNumberPurchase() {
    window.open(buildNumberPurchaseWhatsAppUrl(), "_blank", "noopener,noreferrer");
    notifyNumberPurchase.mutate(undefined, {
      onSuccess: () => toast.success("Pedido enviado! A equipe vai te chamar no WhatsApp."),
      onError: () => toast.success("Abrimos o WhatsApp do nosso comercial para você."),
    });
  }

  const undo = (id: string) => {
    setDoneIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    persist({ removeDoneIds: [id] });
  };

  function handleConnected() {
    setIsConnectedNow(true);
    markDone(META_DONE_ID);
    refetchPanel();
  }

  const { data: liveProgress } = useConnectProgress(trackingId);
  const liveDrafts = (liveProgress ?? progress).drafts;

  const cardItems = buildCardChecklist({ paymentMethodsUrl });
  const isItemDone = (item: { id: string; isAutoDone?: boolean }) => doneIds.has(item.id) || Boolean(item.isAutoDone);
  // Número de teste da Meta não é cobrado: o cartão pode ficar para depois.
  const isTestNumber = Boolean(setupStatus?.phone?.isTestNumber);
  const isCardDone = cardItems.every(isItemDone) || isTestNumber;

  const guideDone = doneIds.has(META_DONE_ID) ? guideProgress.total : guideProgress.done;
  const overallDone =
    (doneIds.has(NUMBER_STEP_ID) || stepIndex > 0 ? 1 : 0) + guideDone + cardItems.filter(isItemDone).length + (stepIndex === 3 && isConnected ? 1 : 0);
  const overallTotal = 2 + guideProgress.total + cardItems.length;
  const journeyStops = buildConnectJourneyStops(DEFAULT_GUIDE_STEPS, cardItems.map((item) => item.id));

  return (
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
      <Dialog open={isDesktopTipOpen} onOpenChange={(isOpen) => !isOpen && setIsDesktopTipDismissed(true)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] gap-6 px-6 pt-7 pb-6 sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="items-center gap-3 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-info/15 text-info">
              <Laptop className="size-7" />
            </span>
            <DialogTitle className="text-lg">Melhor no computador</DialogTitle>
            <DialogDescription className="text-[15px] leading-relaxed text-muted-foreground">
              Para uma experiência melhor, faça este passo a passo num <strong className="text-foreground">notebook ou computador</strong>: você vê a Meta e a ÓRBITA lado a lado e termina em uns 10 minutos. Seu progresso fica salvo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button className="h-12 w-full rounded-full text-[15px]" onClick={copyLinkForComputer}>
              <Copy className="size-4" /> Copiar link para o computador
            </Button>
            <Button variant="ghost" className="h-11 w-full rounded-full" onClick={() => setIsDesktopTipDismissed(true)}>
              Continuar pelo celular
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <DialogHeader>
          {/* O título é a ação da tela atual — o passo a passo fala por si. */}
          <DialogTitle>{STAGE_TITLES[stepIndex] ?? (stepIndex === 1 && !(isConnected && isGuideDone) ? guideStepTitle : "Número conectado")}</DialogTitle>
          <DialogDescription className="sr-only">Conectar número oficial do WhatsApp</DialogDescription>
        </DialogHeader>

        <Stepper currentIndex={stepIndex} />
        <ChecklistProgress
          className="max-sm:hidden"
          doneCount={overallDone}
          total={overallTotal}
          label={`Passo ${Math.min(overallDone + 1, overallTotal)} de ${overallTotal}`}
          isCountHidden
        />

        <div
          key={stepIndex}
          className="animate-in fade-in slide-in-from-right-4 flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto duration-300"
        >
          {stepIndex === 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { source: "own", icon: Smartphone, title: "Tenho um número", text: "Uso um chip da empresa." },
                  { source: "salvy", icon: ShoppingCart, title: "Comprar número", text: "Fale com a equipe pelo WhatsApp e receba um número pronto." },
                ] as const).map((option) => (
                  <button
                    key={option.source}
                    type="button"
                    onClick={() => (option.source === "own" ? chooseOwnNumber() : requestNumberPurchase())}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all hover:border-success/60",
                      numberSource === option.source && "border-success bg-success/5 ring-1 ring-success",
                    )}
                  >
                    <option.icon className="mb-2 size-5 text-success" />
                    <p className="font-medium">{option.title}</p>
                    <p className="text-xs text-muted-foreground">{option.text}</p>
                  </button>
                ))}
              </div>

              {numberSource === "own" && isChecklistConfirmed && (
                <button
                  type="button"
                  onClick={() => setIsOwnNumberDialogOpen(true)}
                  className="flex items-center gap-2 self-start rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success"
                >
                  <Check className="size-3.5" /> Número confere com os requisitos · ver de novo
                </button>
              )}

              {numberSource === "salvy" && salvyNumber && (
                <CopyField label="Seu número novo — use no pop-up da Meta" value={salvyNumber.phoneNumber} />
              )}

              <Dialog open={isOwnNumberDialogOpen} onOpenChange={setIsOwnNumberDialogOpen}>
                <DialogContent className="max-w-[calc(100vw-2rem)] gap-3 sm:max-w-md">
                  <DialogHeader className="items-center text-center">
                    <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success">
                      <Smartphone className="size-6" />
                    </span>
                    <DialogTitle>Seu número precisa ter</DialogTitle>
                    <DialogDescription>Confira os 3 itens antes de seguir.</DialogDescription>
                  </DialogHeader>
                  <ul className="space-y-2">
                    {OWN_NUMBER_CHECKLIST.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 rounded-[14px] bg-muted/60 p-2.5 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" /> {item}
                      </li>
                    ))}
                  </ul>
                  <p className="rounded-[14px] bg-brand-whatsapp/10 p-2.5 text-xs text-foreground/80">
                    Depois de conectado, todas as conversas desse número chegam no <strong>Chat da ÓRBITA</strong>: a equipe
                    atende junto, cada contato vira lead no funil e o Astro ajuda nas respostas.
                  </p>
                  <Button
                    className="h-11 w-full rounded-full bg-brand-whatsapp! font-bold text-brand-whatsapp-deep! hover:bg-brand-whatsapp/90!"
                    onClick={confirmOwnNumber}
                  >
                    Meu número atende a tudo isso
                  </Button>
                </DialogContent>
              </Dialog>
            </>
          )}

          {stepIndex === 1 && (
            <>
              {isEmbeddedSignupConfigured && (
                <div className="space-y-2">
                  <WhatsAppEmbeddedSignupButton
                    trackingId={trackingId}
                    onSuccess={() => {
                      toast.success("Número conectado à Meta!");
                      handleConnected();
                    }}
                  />
                  {salvyNumber && <LiveSmsCode numberId={salvyNumber.id} />}
                  <p className="text-center text-xs text-muted-foreground">ou siga o passo a passo abaixo</p>
                </div>
              )}
              {isConnected && isGuideDone ? (
                <NumberSetup trackingId={trackingId} onConnected={handleConnected} />
              ) : (
                <MetaGuideStepper
                  onAskAstro={(question) => {
                    onOpenChange(false);
                    useAstroWidgetStore.getState().open({ text: question, fromVoice: false });
                  }}
                  guide={WHATSAPP_GUIDE}
                  isTitleHidden
                  initialSlug={progress.guideSlug}
                  cheeredIds={doneIds}
                  copyValues={{ callbackUrl: setupStatus?.callbackUrl, verifyToken: setupStatus?.verifyToken }}
                  accountIds={{ appId: liveDrafts.appId, businessId: liveDrafts.businessId }}
                  onStepChange={(step, index, total) => {
                    setGuideProgress({ done: index, total });
                    setGuideStepTitle(step.title);
                    persistGuideSlug(step.slug);
                  }}
                  onCheer={markDone}
                  canAdvance={(step) =>
                    step.slug === "colar-orbita" ? Boolean(setupStatus?.hasKeys) : step.slug === "conferir" ? isConnected : true
                  }
                  renderStepExtra={(step) =>
                    step.slug === "painel" ? (
                      <KeyDraftField
                        trackingId={trackingId}
                        name="appPageUrl"
                        savedHint={
                          liveDrafts.appId
                            ? `app ${liveDrafts.appId}${liveDrafts.businessId ? ` · portfólio ${liveDrafts.businessId}` : ""}`
                            : null
                        }
                      />
                    ) : step.slug === "tem-usuario-sistema" ? (
                      <KeyDraftField trackingId={trackingId} name="businessPageUrl" savedHint={liveDrafts.businessId} />
                    ) : step.slug === "token-copiar" ? (
                      <KeyDraftField trackingId={trackingId} name="accessToken" savedHint={liveDrafts.accessToken.last4} />
                    ) : step.slug === "id-e-chave-secreta" ? (
                      <div className="space-y-2">
                        <KeyDraftField trackingId={trackingId} name="appId" savedHint={liveDrafts.appId} />
                        <KeyDraftField trackingId={trackingId} name="appSecret" savedHint={liveDrafts.appSecret.last4} />
                      </div>
                    ) : step.slug === "colar-orbita" ? (
                      <MetaKeysForm
                        trackingId={trackingId}
                        drafts={liveDrafts}
                        hasSavedKeys={Boolean(setupStatus?.hasKeys)}
                        onSaved={() => undefined}
                      />
                    ) : step.slug === "conferir" ? (
                      <NumberSetup
                        trackingId={trackingId}
                        presetPhone={salvyNumber?.phoneNumber}
                        salvyNumberId={salvyNumber?.id}
                        onConnected={handleConnected}
                      />
                    ) : null
                  }
                  onFinished={() => {
                    markDone(META_DONE_ID);
                    setStepIndex(2);
                  }}
                />
              )}
            </>
          )}

          {stepIndex === 2 && isTestNumber && (
            <p className="rounded-md border border-info/30 bg-info/5 p-3 text-sm text-info dark:text-info">
              Você está usando um <strong>número de teste</strong> da Meta: as mensagens para os celulares cadastrados são
              grátis, então o cartão pode ficar para depois. Cadastre o cartão antes de trocar para o número da empresa.
            </p>
          )}

          {stepIndex === 2 && <GuidedChecklist items={cardItems} doneIds={doneIds} onMarkDone={markDone} onUndo={undo} isProgressHidden />}

          {stepIndex === 3 &&
            (isPanelLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <OrbitaSpinner className="size-4 " /> Conferindo seu número na Meta…
              </p>
            ) : isConnected ? (
              <>
                <p className="flex items-center gap-2 text-sm font-medium text-success dark:text-success">
                  <Phone className="size-4" /> Tudo pronto! Este é o seu número oficial:
                </p>
                <MetaNumberPanel trackingId={trackingId} />
              </>
            ) : (
              <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
                <p className="font-medium">Falta só a Meta confirmar seu número</p>
                <p className="text-muted-foreground">
                  Ainda não encontramos um número conectado neste funil. Se a nossa equipe está conectando com você, ele aparece
                  aqui assim que terminar — aí você já pode criar a primeira campanha.
                </p>
                <Button size="sm" variant="outline" onClick={() => refetchPanel()} disabled={isPanelFetching}>
                  {isPanelFetching && <OrbitaSpinner className="size-4 " />} Conferir de novo
                </Button>
              </div>
            ))}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t pt-3 sm:flex-wrap">
          <div className="scroll-hidden-x flex min-w-0 items-center gap-1 overflow-x-auto sm:flex-wrap">
            <RequestTeamHelp step={`Conectar número — ${STEPS[stepIndex].label}`} />
            {stepIndex === 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  onOpenChange(false);
                  useAstroWidgetStore.getState().open({
                    text: "Me ajuda a conectar meu WhatsApp oficial: o que já está pronto e o que falta?",
                    fromVoice: false,
                  });
                }}
              >
                <Bot className="size-4" /> Pedir ao Astro
              </Button>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {stepIndex === 2 && (
              <Button variant="ghost" onClick={() => setStepIndex(stepIndex - 1)}>
                Voltar
              </Button>
            )}
            {stepIndex === 0 && (
              <Button
                className={PRIMARY_STEP_BUTTON_CLASS}
                onClick={() => {
                  markDone(NUMBER_STEP_ID);
                  setStepIndex(1);
                }}
                disabled={!canLeaveNumberStep}
              >
                Continuar
              </Button>
            )}
            {stepIndex === 1 && isConnected && isGuideDone && (
              <Button className={PRIMARY_STEP_BUTTON_CLASS} onClick={() => setStepIndex(2)}>Continuar</Button>
            )}
            {stepIndex === 2 && (
              <Button className={PRIMARY_STEP_BUTTON_CLASS} onClick={() => setStepIndex(3)} disabled={!isCardDone}>
                Continuar
              </Button>
            )}
            {stepIndex === 3 && <Button className={PRIMARY_STEP_BUTTON_CLASS} onClick={() => onOpenChange(false)}>Concluir</Button>}
          </div>
        </div>
      </div>
      <aside className="hidden min-h-0 lg:block">
        <div className="h-full">
          <SpaceJourney stops={journeyStops} currentIndex={overallDone} title="Rumo ao número oficial" />
        </div>
      </aside>
    </div>
  );
}
