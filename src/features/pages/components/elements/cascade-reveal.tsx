"use client";

/**
 * Entrada em cascata: quando o bloco aparece na tela, cada peça marcada com `data-cascade-item`
 * (cards, título, botões…) surge uma depois da outra. Roda uma vez; ao terminar, o wrapper larga
 * o atributo para não interferir nas transições próprias dos cards (hover etc.).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type CascadePhase = "pending" | "revealing" | "done";

const CASCADE_VISIBLE_THRESHOLD = 0.08;
const CASCADE_SETTLE_MARGIN_MS = 120;

const CASCADE_STYLES = `
[data-cascade] [data-cascade-item]{transition:opacity var(--cascade-duration) cubic-bezier(.22,1,.36,1),transform var(--cascade-duration) cubic-bezier(.22,1,.36,1);transition-delay:calc(var(--cascade-index,0) * var(--cascade-step))}
[data-cascade="pending"] [data-cascade-item]{opacity:0;transform:translate3d(0,var(--cascade-distance),0);transition:none}
@media (prefers-reduced-motion:reduce){[data-cascade] [data-cascade-item]{opacity:1!important;transform:none!important;transition:none!important}}
`;

const CASCADE_NO_SCRIPT_STYLES =
  "[data-cascade] [data-cascade-item]{opacity:1!important;transform:none!important}";

export interface CascadeRevealProps {
  stepMs: number;
  durationMs: number;
  distance: number;
}

export function CascadeReveal({
  stepMs,
  durationMs,
  distance,
  children,
}: CascadeRevealProps & { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<CascadePhase>("pending");

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof IntersectionObserver === "undefined") return;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const cascadeItems = wrapper.querySelectorAll<HTMLElement>("[data-cascade-item]");
        cascadeItems.forEach((cascadeItem, itemIndex) => {
          cascadeItem.style.setProperty("--cascade-index", String(itemIndex));
        });
        setPhase("revealing");
        settleTimer = setTimeout(
          () => setPhase("done"),
          cascadeItems.length * stepMs + durationMs + CASCADE_SETTLE_MARGIN_MS,
        );
      },
      { threshold: CASCADE_VISIBLE_THRESHOLD },
    );
    observer.observe(wrapper);

    return () => {
      observer.disconnect();
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [stepMs, durationMs]);

  const cascadeVariables = {
    "--cascade-step": `${stepMs}ms`,
    "--cascade-duration": `${durationMs}ms`,
    "--cascade-distance": `${distance}px`,
  } as CSSProperties;

  return (
    <div ref={wrapperRef} data-cascade={phase === "done" ? undefined : phase} style={cascadeVariables}>
      <style dangerouslySetInnerHTML={{ __html: CASCADE_STYLES }} />
      {/* Sem JavaScript nada revelaria as peças: o conteúdo aparece direto. */}
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: CASCADE_NO_SCRIPT_STYLES }} />
      </noscript>
      {children}
    </div>
  );
}

export const CASCADE_DEFAULTS: CascadeRevealProps = { stepMs: 120, durationMs: 600, distance: 24 };

/** Lê a configuração do bloco; `null` quando a cascata está desligada. */
export function getCascadeRevealProps(element: { [key: string]: unknown }): CascadeRevealProps | null {
  if (!element.cascadeReveal) return null;
  return {
    stepMs: (element.cascadeStepMs as number | undefined) ?? CASCADE_DEFAULTS.stepMs,
    durationMs: (element.cascadeDurationMs as number | undefined) ?? CASCADE_DEFAULTS.durationMs,
    distance: (element.cascadeDistance as number | undefined) ?? CASCADE_DEFAULTS.distance,
  };
}
