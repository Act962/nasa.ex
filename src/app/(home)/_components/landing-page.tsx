"use client";

import { authClient } from "@/lib/auth-client";
import { STYLES } from "./styles";

// Ordem narrativa briefing § 2:
// 1. Herói → 2. Manifesto → 3. Método N.A.S.A.® (estágios)
// → 4. Automação (destaque) → 5. Grid de ferramentas por etapa
// → 6. Astro → 7. Space Station → 8. Insights → 9. STARs
// → 10. Comece por um processo → 11. Pricing/simulador → 12. Fechamento
//
// Removidas como seções próprias:
//  - StatsSection, números absorvidos como sub-strip do herói
//  - PatternsFeatureSection, CTA absorvido em "Comece por um processo"
//
// Preservadas:
//  - IntegrationsMarquee, fica entre Insights e STARs como prova
//    "trabalha com tudo que você já usa"
//  - GamifiedRankingSection, preservada por decisão de produto
//    (feature em finalização)
//  - AppsShowcaseSection, catálogo de integrações externas (≠ AppsSection)

import { HeroSection } from "./sections/hero-section";
import { PartnersMarquee } from "./sections/partners-marquee";
import { ManifestoSection } from "./sections/manifesto-section";
import { NasaMethodSection } from "./sections/nasa-method-section";
import { AutomationSection } from "./sections/automation-section";
import { AppsSection } from "./sections/apps-section";
import { AstroSection } from "./sections/astro-section";
import { SpaceStationSection } from "./sections/space-station-section";
import { InsightsFeatureSection } from "./sections/insights-feature-section";
import { IntegrationsMarquee } from "./sections/integrations-marquee";
import { StarsInfoSection } from "./sections/stars-info-section";
import { StartWithProcessSection } from "./sections/start-with-process-section";
import { PlansPublicSection } from "./sections/plans-public-section";
import { AppsShowcaseSection } from "./sections/apps-showcase-section";
import { SimulatorSection } from "./sections/simulator-section";
import { GamifiedRankingSection } from "./sections/gamified-ranking-section";
import { FinalCTASection } from "./sections/final-cta-section";
import { NewFooter } from "./new-footer";

export function LandingPage() {
  const { data: session, isPending } = authClient.useSession();
  const isLoggedIn = !!session?.user && !isPending;

  return (
    <>
      <style>{STYLES}</style>
      <HeroSection isLoggedIn={isLoggedIn} />
      <PartnersMarquee />
      <ManifestoSection />
      <NasaMethodSection />
      <AutomationSection />
      <AppsSection />
      <AstroSection />
      <SpaceStationSection />
      <InsightsFeatureSection isLoggedIn={isLoggedIn} />
      <IntegrationsMarquee />
      <StarsInfoSection isLoggedIn={isLoggedIn} />
      <StartWithProcessSection />
      <PlansPublicSection isLoggedIn={isLoggedIn} />
      <AppsShowcaseSection isLoggedIn={isLoggedIn} />
      <SimulatorSection isLoggedIn={isLoggedIn} />
      <GamifiedRankingSection isLoggedIn={isLoggedIn} />
      <FinalCTASection isLoggedIn={isLoggedIn} />
      <NewFooter />
    </>
  );
}
