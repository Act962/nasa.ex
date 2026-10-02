"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { PLATFORM_DEFS } from "@/features/integrations/components/integrations-page";
import { useChannelOrbit, useQueryPlatformIntegrations } from "@/features/integrations/hooks/use-integrations";
import { useAstroAiMode } from "@/features/astro/hooks/use-astro-ai-mode";
import { AI_PLATFORMS } from "../data/constants";

/**
 * Satélites em órbita do ASTRO na Início (spec 0053, RF-11): uma órbita inclinada, em que cada
 * satélite passa por trás do disco na metade de cima. O "+" fica fixo e sempre visível.
 */

const MAX_ORBITING_SATELLITES = 6;
const ORBIT_RADIUS_X_PX = 66;
const ORBIT_RADIUS_Y_PX = 22;
const ORBIT_SECONDS_PER_TURN = 28;
const BACK_SCALE = 0.72;
const BACK_OPACITY = 0.55;

interface OrbitingSatellite {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

function isAiPlatform(platform: string) {
  return (AI_PLATFORMS as readonly string[]).includes(platform);
}

function useOrbitingSatellites(): OrbitingSatellite[] {
  const { data: integrationsData } = useQueryPlatformIntegrations();
  const { data: aiModeData } = useAstroAiMode();
  const { data: channelOrbit } = useChannelOrbit();

  const activePlatforms = (integrationsData?.integrations ?? [])
    .filter((integration) => integration.isActive)
    .map((integration) => integration.platform as string);
  if (channelOrbit?.isWhatsAppConnected) activePlatforms.push("WHATSAPP");
  if (channelOrbit?.isInstagramConnected && !activePlatforms.includes("INSTAGRAM")) {
    activePlatforms.push("INSTAGRAM");
  }
  // IA mantida pela equipe ÓRBITA (ex.: Gemini da plataforma) orbita sempre, mesmo sem a org conectar.
  for (const platform of aiModeData?.platformAiPlatforms ?? []) {
    if (!activePlatforms.includes(platform)) activePlatforms.push(platform);
  }
  activePlatforms.sort((left, right) => Number(isAiPlatform(right)) - Number(isAiPlatform(left)));

  return activePlatforms
    .flatMap((platform) => {
      const platformDef = PLATFORM_DEFS.find((definition) => definition.platform === platform);
      if (!platformDef) return [];
      const PlatformIcon = platformDef.icon;
      return [
        {
          key: platform,
          label: platformDef.label,
          href: `/integrations?connect=${platform}`,
          icon: <PlatformIcon className="size-[18px]" />,
        },
      ];
    })
    .slice(0, MAX_ORBITING_SATELLITES);
}

function placeSatellite(element: HTMLElement, angleRad: number) {
  const depth = Math.sin(angleRad);
  const isBehind = depth < 0;
  const scale = isBehind ? BACK_SCALE + (1 - BACK_SCALE) * (1 + depth) : 1;
  element.style.transform = `translate(${Math.cos(angleRad) * ORBIT_RADIUS_X_PX}px, ${depth * ORBIT_RADIUS_Y_PX}px) scale(${scale.toFixed(3)})`;
  element.style.opacity = isBehind ? String(BACK_OPACITY + (1 - BACK_OPACITY) * (1 + depth)) : "1";
  element.style.zIndex = isBehind ? "0" : "20";
}

export function AstroSatellites() {
  const satellites = useOrbitingSatellites();
  const satelliteRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const elements = satelliteRefs.current.slice(0, satellites.length);
    const phaseStepRad = (Math.PI * 2) / Math.max(satellites.length, 1);
    const placeAll = (elapsedSeconds: number) => {
      const turnRad = (elapsedSeconds / ORBIT_SECONDS_PER_TURN) * Math.PI * 2;
      elements.forEach((element, satelliteIndex) => {
        if (element) placeSatellite(element, Math.PI * 0.25 + satelliteIndex * phaseStepRad + turnRad);
      });
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      placeAll(0);
      return;
    }
    const startedAt = performance.now();
    let animationFrame = requestAnimationFrame(function tick(now) {
      placeAll((now - startedAt) / 1000);
      animationFrame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [satellites.length]);

  return (
    <div aria-label="Satélites do ASTRO" className="pointer-events-none absolute inset-0">
      {satellites.map((satellite, satelliteIndex) => (
        <Link
          key={satellite.key}
          ref={(element) => {
            satelliteRefs.current[satelliteIndex] = element;
          }}
          href={satellite.href}
          aria-label={satellite.label}
          title={satellite.label}
          className="pointer-events-auto absolute top-1/2 left-1/2 -mt-[17px] -ml-[17px] grid size-[34px] place-items-center rounded-full bg-knob text-foreground shadow-md will-change-transform"
        >
          {satellite.icon}
        </Link>
      ))}

      <Link
        href="/integrations"
        aria-label="Adicionar satélite"
        title="Adicionar satélite"
        className="pointer-events-auto absolute -top-1 -right-1 z-30 grid size-[30px] place-items-center rounded-full border border-dashed border-foreground/50 bg-background/60 text-foreground backdrop-blur-sm transition-transform hover:scale-110"
      >
        <PlusIcon className="size-4" />
      </Link>
    </div>
  );
}
