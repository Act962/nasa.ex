"use client";

import { cn } from "@/lib/utils";

/**
 * Logos das plataformas no card de canal.
 *
 * O Meta aparece acompanhado de Facebook e Instagram de propósito: muita gente
 * não reconhece o nome "Meta", mas reconhece na hora o F azul e a câmera do
 * Instagram. As marcas filhas é que comunicam onde o anúncio vai aparecer.
 */

interface PlatformLogosProps {
  slugs: string[];
  className?: string;
}

const LOGO_ALT: Record<string, string> = {
  meta: "Meta",
  facebook: "Facebook",
  instagram: "Instagram",
  google: "Google",
  whatsapp: "WhatsApp",
};

export function PlatformLogos({ slugs, className }: PlatformLogosProps) {
  const [primary, ...secondary] = slugs;

  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/redes/${primary}.png`}
        alt={LOGO_ALT[primary] ?? primary}
        width={40}
        height={40}
        className="h-7 w-auto object-contain"
      />

      {secondary.length > 0 && (
        <>
          <span aria-hidden className="h-5 w-px bg-white/15" />
          <span className="flex items-center gap-1">
            {secondary.map((slug) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={slug}
                src={`/redes/${slug}.png`}
                alt={LOGO_ALT[slug] ?? slug}
                width={26}
                height={26}
                className="h-5 w-auto object-contain"
              />
            ))}
          </span>
        </>
      )}
    </span>
  );
}
