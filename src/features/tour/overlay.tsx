"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { subscribeTourResult, useTourStore } from "./store";
import { useTourTarget } from "./use-tour-target";
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
`;

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

  useEffect(() => {
    if (!isActive || isFinished || !currentStep) return;
    const currentPath = pathnameRef.current;
    if (currentStep.skipWhenPath && new RegExp(currentStep.skipWhenPath).test(currentPath)) {
      nextStep();
      return;
    }
    if (currentStep.route && currentPath !== currentStep.route) router.push(currentStep.route);
  }, [isActive, isFinished, currentStep, nextStep, router]);
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
  useAdvanceOnTargetClick(target.element, currentStep?.advanceOn === "click", nextStep);
  useIsolateFromOutsideClick(rootElement);

  if (!isMounted || !isActive) return null;

  const renderContent = () => {
    if (isFinished && finish) {
      const openResult = () => {
        if (result) router.push(result.href);
        endTour();
      };
      return (
        <TourCenterCard
          title={finish.title}
          message={finish.message}
          actions={
            result
              ? [
                  { label: "Fechar", onClick: endTour },
                  { label: result.label ?? finish.resultLabel ?? "Abrir", onClick: openResult, isPrimary: true },
                ]
              : [{ label: "Fechar", onClick: endTour, isPrimary: true }]
          }
        />
      );
    }

    if (!currentStep) return null;

    if (target.isMissing) {
      return (
        <TourCenterCard
          title="Não encontrei esse item nesta tela"
          message={`Eu procurava "${currentStep.title}". A tela pode estar carregando, ou esse item não está disponível para você.`}
          actions={[
            { label: "Encerrar", onClick: endTour },
            { label: "Pular passo", onClick: nextStep, isPrimary: true },
          ]}
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
          onNext={nextStep}
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
