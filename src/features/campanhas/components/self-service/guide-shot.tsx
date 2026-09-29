"use client";

import { useState } from "react";
import { ImageOff, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  guideImageSrc,
  guideTargetPercent,
  type GuideArrowSide,
  type GuideStep,
} from "../../lib/whatsapp-connect-guide";

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
            stroke="#ef4444"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}

/** Largura ÷ altura do print já recortado. */
function shotRatio(shot: NonNullable<GuideStep["shot"]>): number {
  const [left, top, right, bottom] = shot.crop ?? [0, 0, shot.w, shot.h];
  return (right - left) / (bottom - top);
}

function ShotWithTarget({
  step,
  isFitted = false,
  onMissing,
}: {
  step: GuideStep;
  /** Cabe inteiro na caixa do pai (altura fixa), sem distorcer: a seta continua no alvo. */
  isFitted?: boolean;
  onMissing: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const src = guideImageSrc(step);
  if (!src || !step.shot) return null;
  const target = guideTargetPercent(step.shot);
  const ratio = shotRatio(step.shot);
  return (
    <div
      className="relative shrink-0"
      style={{
        aspectRatio: `${ratio}`,
        width: isFitted ? `min(100cqw, ${ratio} * 100cqh)` : "100%",
      }}
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
          className="pointer-events-none absolute rounded-md ring-[3px] ring-red-500"
          style={{
            left: `${target.left}%`,
            top: `${target.top}%`,
            width: `${target.width}%`,
            height: `${target.height}%`,
          }}
        >
          <span className="absolute inset-0 animate-ping rounded-md bg-red-500/30" />
          <TargetArrow side={step.shot.arrow} />
        </span>
      )}
    </div>
  );
}

/** Print da tela da Meta com o botão onde clicar destacado em vermelho (spec 0040, RF-3). */
export function GuideShot({
  step,
  isFitted = false,
  className,
}: {
  step: GuideStep;
  /** Ocupa o espaço que o pai der (popup sem rolagem): o print encolhe inteiro. */
  isFitted?: boolean;
  className?: string;
}) {
  const [isMissing, setIsMissing] = useState(!step.shot);
  const [isZoomed, setIsZoomed] = useState(false);

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
        onClick={() => setIsZoomed(true)}
        className={cn(
          "group guide-shot-frame relative w-full cursor-pointer overflow-hidden rounded-lg border text-left transition-colors hover:border-sky-500 focus-visible:border-sky-500 focus-visible:outline-none",
          isFitted ? "flex items-center justify-center bg-muted/20" : "block bg-white",
          className,
        )}
        style={isFitted ? { containerType: "size" } : undefined}
      >
        <ShotWithTarget step={step} isFitted={isFitted} onMissing={() => setIsMissing(true)} />
        <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
          <ZoomIn className="size-3.5" /> Ampliar
        </span>
      </button>
      <Dialog open={isZoomed} onOpenChange={setIsZoomed}>
        <DialogContent className="max-w-[min(96vw,1400px)] p-2 sm:max-w-[min(96vw,1400px)]">
          <DialogTitle className="sr-only">{step.title}</DialogTitle>
          <ShotWithTarget step={step} onMissing={() => setIsMissing(true)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
