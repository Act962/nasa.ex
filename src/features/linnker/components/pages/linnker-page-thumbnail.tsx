"use client";

import { useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Miniatura fiel: a própria página pública (/l/<slug>) em escala, do jeito que o visitante vê.
 * Só carrega quando o cartão chega perto da tela e usa ?preview=1 para não contar visita.
 */

const PHONE_WIDTH_PX = 400;
const PRELOAD_MARGIN = "240px";

interface LinnkerPageThumbnailProps {
  slug: string;
  title: string;
  /** Muda quando a página é salva de novo: a miniatura recarrega. */
  versionKey: string;
  className?: string;
}

export function LinnkerPageThumbnail({ slug, title, versionKey, className }: LinnkerPageThumbnailProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [loadedVersionKey, setLoadedVersionKey] = useState<string | null>(null);

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

  const scale = frameSize ? frameSize.width / PHONE_WIDTH_PX : 0;
  const shouldRenderPage = isNearViewport && scale > 0;
  const isLoaded = loadedVersionKey === versionKey;

  return (
    <div ref={frameRef} className={cn("relative aspect-[3/4] w-full overflow-hidden bg-muted", className)} aria-hidden>
      {shouldRenderPage && frameSize && (
        <iframe
          key={versionKey}
          title={`Prévia — ${title}`}
          src={`/l/${encodeURIComponent(slug)}?preview=1&v=${encodeURIComponent(versionKey)}`}
          loading="lazy"
          tabIndex={-1}
          scrolling="no"
          sandbox="allow-same-origin allow-scripts"
          onLoad={() => setLoadedVersionKey(versionKey)}
          className={cn(
            "pointer-events-none absolute top-0 left-0 origin-top-left border-0 transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          style={{
            width: PHONE_WIDTH_PX,
            height: frameSize.height / scale,
            transform: `scale(${scale})`,
          }}
        />
      )}
      {!isLoaded && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <div className="orbita-shimmer absolute inset-0" />
          <Link2 className="relative size-6" />
        </div>
      )}
    </div>
  );
}
