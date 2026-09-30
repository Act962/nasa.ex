"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { subscribeTourResult, useTourStore } from "./store";
import { findRenderedElement, useTourTarget } from "./use-tour-target";
import { HoleBlockers, Spotlight, toHoleRect } from "./spotlight";
import { GuideArrow } from "./guide-arrow";
import { TourBubble, placeBubble } from "./tour-bubble";
import { TourCenterCard } from "./tour-center-card";

const BUBBLE_GAP_PX = 56;

const TOUR_KEYFRAMES = `
  @keyframes tourPulse {
    0%   { opacity: 0.7; transform: scale(1); }
    100% { opacity: 0;   transform: scale(1.15); }
  }
  @keyframes tourBubbleIn {
    from { opacity: 0; transform: scale(0.88) translateY(8px); }
    to   { opacity: 1; transform: scale(1)    translateY(0); }
  }
  @keyframes guideArrowNudge {
    0%, 100% { transform: translateX(-5px); }
    50%      { transform: translateX(5px); }
  }
  /* Select, Dropdown e Popover do Radix abrem em portal com z-50: sem isto
     ficariam atrás do escurecido e fora do alcance do clique (spec 0048, RF-4). */
  [data-radix-popper-content-wrapper] { z-index: 10010 !important; pointer-events: auto; }
  /* Select em modo item-aligned não usa o wrapper do popper: o Radix copia para
     o contêiner o z-index calculado do conteúdo no momento em que abre. */
  [data-slot="select-content"],
  [data-slot="dropdown-menu-content"],
  [data-slot="popover-content"] { z-index: 10010 !important; }
`;

const SKIP_CHECK_INTERVAL_MS = 200;

/** Pula o passo desnecessário e abre a rota do passo (spec 0046, RF-3). */
function useStepRouting() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const isActive = useTourStore((state) => state.isActive);
  const isFinished = useTourStore((state) => state.isFinished);
  const stepIndex = useTourStore((state) => state.stepIndex);
  const steps = useTourStore((state) => state.steps);
  const nextStep = useTourStore((state) => state.nextStep);
  const currentStep = steps[stepIndex];

  // Reavaliado a cada troca de rota: o usuário pode chegar ao destino do passo
  // por conta própria (ex.: menu ⋯ → Editar), e o passo fica para trás.
  useEffect(() => {
    if (!isActive || isFinished || !currentStep?.skipWhenPath) return;
    if (new RegExp(currentStep.skipWhenPath).test(pathname)) nextStep(stepIndex);
  }, [isActive, isFinished, currentStep, stepIndex, pathname, nextStep]);

  // Só na entrada do passo: navegar de novo a cada troca de rota prenderia o usuário.
  useEffect(() => {
    if (!isActive || isFinished || !currentStep?.route) return;
    const currentPath = pathnameRef.current;
    const isSkippedByPath =
      currentStep.skipWhenPath && new RegExp(currentStep.skipWhenPath).test(currentPath);
    // Rota com query (ex.: /payment?tab=payables) compara também a busca: a aba é o destino.
    const currentLocation = currentStep.route.includes("?")
      ? `${window.location.pathname}${window.location.search}`
      : currentPath;
    if (!isSkippedByPath && currentLocation !== currentStep.route) router.push(currentStep.route);
  }, [isActive, isFinished, currentStep, stepIndex, router]);

  // A tela pode chegar ao estado do passo seguinte sozinha (lista já aberta).
  useEffect(() => {
    const skipSelector = currentStep?.skipWhenVisible;
    if (!isActive || isFinished || !skipSelector) return;
    const skipIfVisible = () => {
      if (findRenderedElement(skipSelector)) nextStep(stepIndex);
    };
    skipIfVisible();
    const intervalId = window.setInterval(skipIfVisible, SKIP_CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isActive, isFinished, currentStep, stepIndex, nextStep]);
}

/** Avança quando o usuário clica no próprio alvo (RF-2, `click`). */
function useAdvanceOnTargetClick(element: Element | null, shouldListen: boolean, onAdvance: () => void) {
  useEffect(() => {
    if (!element || !shouldListen) return;
    const handleClick = (event: MouseEvent) => {
      if (event.target instanceof Node && element.contains(event.target)) {
        // Depois do clique seguir: o alvo ainda precisa abrir o Sheet ou navegar.
        window.setTimeout(onAdvance, 0);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [element, shouldListen, onAdvance]);
}

/**
 * O `pointerdown` no overlay não pode chegar ao `document`: o Radix entende
 * como clique fora e fecha o Sheet em que o guia está trabalhando (CB-4).
 */
function useIsolateFromOutsideClick(rootElement: HTMLDivElement | null) {
  useEffect(() => {
    if (!rootElement) return;
    const stopPropagation = (event: Event) => event.stopPropagation();
    rootElement.addEventListener("pointerdown", stopPropagation);
    rootElement.addEventListener("mousedown", stopPropagation);
    return () => {
      rootElement.removeEventListener("pointerdown", stopPropagation);
      rootElement.removeEventListener("mousedown", stopPropagation);
    };
  }, [rootElement]);
}

export function TourOverlay() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);

  const isActive = useTourStore((state) => state.isActive);
  const isFinished = useTourStore((state) => state.isFinished);
  const stepIndex = useTourStore((state) => state.stepIndex);
  const steps = useTourStore((state) => state.steps);
  const finish = useTourStore((state) => state.finish);
  const result = useTourStore((state) => state.result);
  const nextStep = useTourStore((state) => state.nextStep);
  const prevStep = useTourStore((state) => state.prevStep);
  const endTour = useTourStore((state) => state.endTour);
  const completeWithResult = useTourStore((state) => state.completeWithResult);

  const currentStep = isActive && !isFinished ? steps[stepIndex] : undefined;
  const target = useTourTarget(currentStep?.selector ?? null, currentStep?.id ?? "");

  useEffect(() => setIsMounted(true), []);
  useEffect(() => (isActive ? subscribeTourResult(completeWithResult) : undefined), [isActive, completeWithResult]);
  useStepRouting();
  const advanceFromCurrentStep = useCallback(() => nextStep(stepIndex), [nextStep, stepIndex]);
  useAdvanceOnTargetClick(target.element, currentStep?.advanceOn === "click", advanceFromCurrentStep);
  useIsolateFromOutsideClick(rootElement);

  if (!isMounted || !isActive) return null;

  const renderContent = () => {
    if (isFinished && finish) {
      const resultHref = result?.href;
      const openResult = () => {
        if (resultHref) router.push(resultHref);
        endTour();
      };
      return (
        <TourCenterCard
          title={finish.title}
          message={finish.message}
          actions={
            resultHref
              ? [
                  { label: "Fechar", onClick: endTour },
                  { label: result?.label ?? finish.resultLabel ?? "Abrir", onClick: openResult, isPrimary: true },
                ]
              : [{ label: "Fechar", onClick: endTour, isPrimary: true }]
          }
        />
      );
    }

    if (!currentStep) return null;
    const isLastStep = stepIndex === steps.length - 1;

    if (target.isMissing) {
      return (
        <TourCenterCard
          title="Não encontrei esse item nesta tela"
          message={
            currentStep.missingMessage ??
            `Eu procurava "${currentStep.title}". A tela pode estar carregando, ou esse item não está disponível para você.`
          }
          actions={
            // Pular o último passo abriria o cartão de sucesso sem nada ter sido feito.
            isLastStep
              ? [{ label: "Encerrar", onClick: endTour, isPrimary: true }]
              : [
                  { label: "Encerrar", onClick: endTour },
                  { label: "Pular passo", onClick: advanceFromCurrentStep, isPrimary: true },
                ]
          }
        />
      );
    }

    if (!target.rect) return null;

    const hole = toHoleRect(target.rect, currentStep.padding ?? 10);
    const placement = placeBubble(hole, currentStep.position, BUBBLE_GAP_PX);
    const isLegacyStep = currentStep.advanceOn === undefined;

    return (
      <>
        <HoleBlockers hole={hole} onBackdropClick={isLegacyStep ? endTour : undefined} />
        <Spotlight hole={hole} pulse={currentStep.pulse} />
        <GuideArrow hole={hole} bubbleSide={placement.side} />
        <TourBubble
          step={currentStep}
          stepIndex={stepIndex}
          total={steps.length}
          placement={placement}
          isInputFilled={target.isInputFilled}
          onNext={advanceFromCurrentStep}
          onPrev={prevStep}
          onSkip={endTour}
        />
      </>
    );
  };

  return createPortal(
    <div ref={setRootElement} style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none" }}>
      <style>{TOUR_KEYFRAMES}</style>
      {renderContent()}
    </div>,
    document.body,
  );
}
