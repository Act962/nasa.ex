"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ImageOff, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { guideImageSrc, guideTargetPercent } from "../lib/guide-helpers";
import type { GuideArrowSide, MetaGuideStep } from "../lib/types";

const ARROW_ROTATION: Record<GuideArrowSide, number> = {
  left: 0,
  top: 90,
  right: 180,
  bottom: 270,
};
const ARROW_OFFSET: Record<GuideArrowSide, string> = {
  left: "right-full top-1/2 -translate-y-1/2 mr-1",
  right: "left-full top-1/2 -translate-y-1/2 ml-1",
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1",
};
const ARROW_NUDGE: Record<GuideArrowSide, string> = {
  left: "animate-[guide-nudge-x_1s_ease-in-out_infinite]",
  right: "animate-[guide-nudge-x_1s_ease-in-out_infinite_reverse]",
  top: "animate-[guide-nudge-y_1s_ease-in-out_infinite]",
  bottom: "animate-[guide-nudge-y_1s_ease-in-out_infinite_reverse]",
};

/** Seta vermelha que aponta o alvo; a ponta fica encostada nele. */
function TargetArrow({ side }: { side: GuideArrowSide }) {
  return (
    <span className={cn("absolute", ARROW_OFFSET[side])}>
      <span className={cn("block", ARROW_NUDGE[side])}>
        <svg
          width="34"
          height="22"
          viewBox="0 0 34 22"
          style={{ transform: `rotate(${ARROW_ROTATION[side]}deg)` }}
          className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
        >
          <path
            d="M2 11h22M17 3l9 8-9 8"
            fill="none"
            stroke="var(--destructive)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}

const LENS_SIZE_PX = 168;
const LENS_ZOOM = 2.6;
/** A lupa fica acima do dedo para ele não cobrir o que está sendo ampliado. */
const LENS_LIFT_PX = 110;

interface LensState {
  /** Posição do dedo/mouse dentro do print, em px. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Lupa redonda que segue o dedo sobre o print e mostra o trecho ampliado e nítido. */
function MagnifierLens({ src, lens }: { src: string; lens: LensState }) {
  // Dentro do print (a moldura corta o que passa da borda); perto do topo, desce e encosta no dedo.
  const lensTop = Math.min(Math.max(lens.y - LENS_LIFT_PX - LENS_SIZE_PX / 2, 0), Math.max(0, lens.height - LENS_SIZE_PX));
  const lensLeft = Math.min(Math.max(lens.x - LENS_SIZE_PX / 2, 0), Math.max(0, lens.width - LENS_SIZE_PX));
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-20 rounded-full border-4 border-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
      style={{
        width: LENS_SIZE_PX,
        height: LENS_SIZE_PX,
        left: lensLeft,
        top: lensTop,
        backgroundColor: "white",
        backgroundImage: `url(${src})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${lens.width * LENS_ZOOM}px ${lens.height * LENS_ZOOM}px`,
        backgroundPosition: `${LENS_SIZE_PX / 2 - lens.x * LENS_ZOOM}px ${LENS_SIZE_PX / 2 - lens.y * LENS_ZOOM}px`,
      }}
    />
  );
}

/** Largura ÷ altura do print já recortado. */
function shotRatio(shot: NonNullable<MetaGuideStep["shot"]>): number {
  const [left, top, right, bottom] = shot.crop ?? [0, 0, shot.w, shot.h];
  return (right - left) / (bottom - top);
}

function ShotWithTarget({
  step,
  imageBasePath,
  isFitted = false,
  isMagnifierEnabled = false,
  onMagnifierUsed,
  onMissing,
}: {
  step: MetaGuideStep;
  imageBasePath: string;
  /** Cabe inteiro na caixa do pai (altura fixa), sem distorcer: a seta continua no alvo. */
  isFitted?: boolean;
  /** Arrastar o dedo (ou o mouse pressionado) mostra a lupa. */
  isMagnifierEnabled?: boolean;
  onMagnifierUsed?: () => void;
  onMissing: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [lens, setLens] = useState<LensState | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  function updateLens(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    const y = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height);
    setLens({ x, y, width: bounds.width, height: bounds.height });
    const start = pointerStartRef.current;
    // Só conta como "usou a lupa" quando arrastou: um toque parado continua abrindo o print em tela cheia.
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) onMagnifierUsed?.();
  }

  function stopLens() {
    pointerStartRef.current = null;
    setLens(null);
  }

  const src = guideImageSrc(step, imageBasePath);
  if (!src || !step.shot) return null;
  const target = guideTargetPercent(step.shot);
  const ratio = shotRatio(step.shot);
  return (
    <div
      className={cn("relative shrink-0", isMagnifierEnabled && "touch-none select-none")}
      style={{
        aspectRatio: `${ratio}`,
        width: isFitted ? `min(100cqw, ${ratio} * 100cqh)` : "100%",
      }}
      onPointerDown={
        isMagnifierEnabled
          ? (event) => {
              if (event.pointerType === "mouse") return;
              pointerStartRef.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
              updateLens(event);
            }
          : undefined
      }
      onPointerMove={
        isMagnifierEnabled
          ? (event) => {
              // Mouse: a lupa segue o cursor; toque: só enquanto o dedo está na tela.
              if (event.pointerType === "mouse" || pointerStartRef.current) updateLens(event);
            }
          : undefined
      }
      onPointerUp={isMagnifierEnabled ? (event) => event.pointerType !== "mouse" && stopLens() : undefined}
      onPointerLeave={isMagnifierEnabled ? stopLens : undefined}
      onPointerCancel={isMagnifierEnabled ? stopLens : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={step.title}
        className={cn("size-full", !isLoaded && "animate-pulse bg-muted")}
        ref={(image) => {
          if (image?.complete && image.naturalWidth > 0) setIsLoaded(true);
        }}
        onLoad={() => setIsLoaded(true)}
        onError={onMissing}
      />
      {isLoaded && (
        <span
          className="pointer-events-none absolute rounded-md ring-[3px] ring-destructive"
          style={{
            left: `${target.left}%`,
            top: `${target.top}%`,
            width: `${target.width}%`,
            height: `${target.height}%`,
          }}
        >
          <span className="absolute inset-0 animate-ping rounded-md bg-destructive/30" />
          <TargetArrow side={step.shot.arrow} />
        </span>
      )}
      {isLoaded && lens && <MagnifierLens src={src} lens={lens} />}
    </div>
  );
}

/** Print da tela da Meta com o botão onde clicar destacado em vermelho (spec 0040, RF-3). */
export function GuideShot({
  step,
  imageBasePath,
  isFitted = false,
  className,
}: {
  step: MetaGuideStep;
  /** Pasta em `public/` com os prints do guia. */
  imageBasePath: string;
  /** Ocupa o espaço que o pai der (popup sem rolagem): o print encolhe inteiro. */
  isFitted?: boolean;
  className?: string;
}) {
  const [isMissing, setIsMissing] = useState(!step.shot);
  const [isZoomed, setIsZoomed] = useState(false);
  const wasMagnifierUsedRef = useRef(false);

  if (isMissing) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 text-xs text-muted-foreground",
          !isFitted && "aspect-video",
          className,
        )}
      >
        <ImageOff className="size-6" />
        Imagem deste passo em preparação
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (wasMagnifierUsedRef.current) {
            wasMagnifierUsedRef.current = false;
            return;
          }
          setIsZoomed(true);
        }}
        className={cn(
          "group guide-shot-frame relative w-full cursor-pointer overflow-hidden rounded-lg border text-left transition-colors hover:border-info focus-visible:border-info focus-visible:outline-none",
          isFitted ? "flex items-center justify-center bg-muted/20" : "block bg-white",
          className,
        )}
        style={isFitted ? { containerType: "size" } : undefined}
      >
        <ShotWithTarget
          step={step}
          imageBasePath={imageBasePath}
          isFitted={isFitted}
          isMagnifierEnabled
          onMagnifierUsed={() => {
            wasMagnifierUsedRef.current = true;
          }}
          onMissing={() => setIsMissing(true)}
        />
        <span className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white">
          <ZoomIn className="size-3.5" /> <span className="md:hidden">Arraste o dedo para ampliar</span>
          <span className="max-md:hidden">Passe o mouse para ampliar</span>
        </span>
      </button>
      <Dialog open={isZoomed} onOpenChange={setIsZoomed}>
        <DialogContent className="max-w-[min(96vw,1400px)] p-2 sm:max-w-[min(96vw,1400px)]">
          <DialogTitle className="sr-only">{step.title}</DialogTitle>
          <ShotWithTarget step={step} imageBasePath={imageBasePath} onMissing={() => setIsMissing(true)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
