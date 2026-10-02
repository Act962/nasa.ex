"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Miniatura fiel do site: a prévia da página (/pages/<id>/preview) em escala,
 * com ?preview=1 (sem barra e sem pixels). Só carrega quando o cartão aparece na tela.
 */

const PAGE_WIDTH_PX = 1280;
const PRELOAD_MARGIN = "240px";

export function PageSiteThumbnail({
  pageId,
  title,
  versionKey,
  className,
}: {
  pageId: string;
  title: string;
  /** Muda quando o site é salvo de novo: a miniatura recarrega. */
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

  const scale = frameSize ? frameSize.width / PAGE_WIDTH_PX : 0;
  const shouldRenderPage = isNearViewport && scale > 0;

  return (
    <div ref={frameRef} className={cn("relative aspect-[3/4] w-full overflow-hidden bg-muted", className)} aria-hidden>
      {shouldRenderPage && frameSize && (
        <iframe
          title={`Prévia — ${title}`}
          src={`/pages/${pageId}/preview?preview=1&v=${encodeURIComponent(versionKey)}`}
          loading="lazy"
          tabIndex={-1}
          scrolling="no"
          sandbox="allow-same-origin allow-scripts"
          onLoad={() => setIsLoaded(true)}
          className={cn(
            "pointer-events-none absolute top-0 left-0 origin-top-left border-0 transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          style={{
            width: PAGE_WIDTH_PX,
            height: frameSize.height / scale,
            transform: `scale(${scale})`,
          }}
        />
      )}
      {!isLoaded && <div className="orbita-shimmer absolute inset-0" />}
    </div>
  );
}
