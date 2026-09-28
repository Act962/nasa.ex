"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { GuideStep } from "./guide-steps";

/** Captura da tela da Meta com um destaque pulsando onde clicar ou colar. */
export function WhereToPaste({ step }: { step: GuideStep }) {
  const [isImageMissing, setIsImageMissing] = useState(false);
  const { highlight } = step;

  return (
    <figure className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border bg-muted/30">
        {isImageMissing ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <ImageOff className="size-6" />
            Imagem do passo em preparação
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={step.imageSrc} alt={step.caption} className="w-full" onError={() => setIsImageMissing(true)} />
            <span
              className="pointer-events-none absolute rounded-md ring-2 ring-emerald-500"
              style={{ left: `${highlight.left}%`, top: `${highlight.top}%`, width: `${highlight.width}%`, height: `${highlight.height}%` }}
            >
              <span className="absolute inset-0 animate-ping rounded-md bg-emerald-500/25" />
            </span>
          </>
        )}
      </div>
      <figcaption className="text-xs text-muted-foreground">{step.caption}</figcaption>
    </figure>
  );
}
