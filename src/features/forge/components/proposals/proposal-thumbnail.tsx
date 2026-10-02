"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Miniatura fiel da proposta: a própria página pública (/proposta/<token>) em
 * escala reduzida — é exatamente o que o cliente vê. Só carrega quando o cartão
 * aparece na tela e usa ?preview=1 para não contar como visualização.
 */

const DOCUMENT_WIDTH_PX = 1100;
const PRELOAD_MARGIN = "240px";

export function ProposalThumbnail({
  publicToken,
  title,
  versionKey,
  className,
}: {
  publicToken: string | null | undefined;
  title: string;
  /** Muda quando a proposta é salva de novo: a miniatura recarrega. */
  versionKey: string;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) setFrameSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsNearViewport(true);
          intersectionObserver.disconnect();
        }
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    resizeObserver.observe(frame);
    intersectionObserver.observe(frame);
    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  const scale = frameSize ? frameSize.width / DOCUMENT_WIDTH_PX : 0;
  const shouldRenderDocument = Boolean(publicToken) && isNearViewport && scale > 0;

  return (
    <div ref={frameRef} className={cn("relative aspect-[3/4] w-full overflow-hidden bg-muted", className)} aria-hidden>
      {shouldRenderDocument && frameSize && (
        <iframe
          title={`Prévia — ${title}`}
          src={`/proposta/${publicToken}?preview=1&v=${encodeURIComponent(versionKey)}`}
          loading="lazy"
          tabIndex={-1}
          scrolling="no"
          sandbox="allow-same-origin allow-scripts"
          onLoad={() => setIsLoaded(true)}
          className={cn("pointer-events-none absolute top-0 left-0 origin-top-left border-0 transition-opacity duration-300", isLoaded ? "opacity-100" : "opacity-0")}
          style={{
            width: DOCUMENT_WIDTH_PX,
            height: frameSize.height / scale,
            transform: `scale(${scale})`,
          }}
        />
      )}
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          {publicToken ? (
            <div className="orbita-shimmer absolute inset-0" />
          ) : (
            <>
              <FileText className="size-7" />
              <span className="px-4 text-center text-[11px]">Salve de novo para gerar a prévia</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
