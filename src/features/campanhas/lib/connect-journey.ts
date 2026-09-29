// Jornada espacial do "Conectar número oficial": cada etapa vira um planeta,
// cada passo dentro dela um asteroide, na mesma ordem da barra "Sua configuração".

import type { JourneyStop, PlanetPalette } from "@/features/space-journey";
import { phaseOf, type GuidePhaseId, type GuideStep } from "./whatsapp-connect-guide";

const PHASE_PLANETS: Record<GuidePhaseId, Pick<JourneyStop, "palette" | "surface" | "hasRing">> = {
  app: { palette: "violet", surface: "bands" },
  whatsapp: { palette: "lime", surface: "craters" },
  number: { palette: "sky", surface: "bands", hasRing: true },
  payment: { palette: "amber", surface: "craters" },
  token: { palette: "rose", surface: "bands" },
  keys: { palette: "amber", surface: "bands", hasRing: true },
  webhook: { palette: "sky", surface: "craters" },
  publish: { palette: "violet", surface: "craters", hasRing: true },
};

const CARD_PALETTE: PlanetPalette = "amber";

export function buildConnectJourneyStops(guideSteps: GuideStep[], cardItemIds: string[]): JourneyStop[] {
  const numberStop: JourneyStop = { id: "number", kind: "planet", label: "Seu número", palette: "teal", surface: "craters" };
  const guideStops = guideSteps.map<JourneyStop>((step, index) => {
    const isPhaseStart = index === 0 || guideSteps[index - 1].phase !== step.phase;
    return isPhaseStart
      ? { id: `guide:${step.slug}`, kind: "planet", label: phaseOf(step.phase).title, ...PHASE_PLANETS[step.phase] }
      : { id: `guide:${step.slug}`, kind: "asteroid", label: step.title };
  });
  const cardStops = cardItemIds.map<JourneyStop>((id, index) =>
    index === 0
      ? { id: `card:${id}`, kind: "planet", label: "Cartão na Meta", palette: CARD_PALETTE, surface: "bands" }
      : { id: `card:${id}`, kind: "asteroid" },
  );
  const destination: JourneyStop = {
    id: "ready",
    kind: "planet",
    label: "Número oficial!",
    palette: "teal",
    surface: "bands",
    hasRing: true,
    isDestination: true,
  };
  return [numberStop, ...guideStops, ...cardStops, destination];
}
