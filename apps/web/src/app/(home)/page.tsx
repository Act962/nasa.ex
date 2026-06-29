"use client";

import { authClient } from "@/lib/auth-client";
import { STYLES } from "./_components/styles";

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

import { HeroSection } from "./_components/sections/hero-section";
import { PartnersMarquee } from "./_components/sections/partners-marquee";
import { ManifestoSection } from "./_components/sections/manifesto-section";
import { NasaMethodSection } from "./_components/sections/nasa-method-section";
import { AutomationSection } from "./_components/sections/automation-section";
import { AppsSection } from "./_components/sections/apps-section";
import { AstroSection } from "./_components/sections/astro-section";
import { SpaceStationSection } from "./_components/sections/space-station-section";
import { InsightsFeatureSection } from "./_components/sections/insights-feature-section";
import { IntegrationsMarquee } from "./_components/sections/integrations-marquee";
import { StarsInfoSection } from "./_components/sections/stars-info-section";
import { StartWithProcessSection } from "./_components/sections/start-with-process-section";
import { PlansPublicSection } from "./_components/sections/plans-public-section";
import { AppsShowcaseSection } from "./_components/sections/apps-showcase-section";
import { SimulatorSection } from "./_components/sections/simulator-section";
import { GamifiedRankingSection } from "./_components/sections/gamified-ranking-section";
import { FinalCTASection } from "./_components/sections/final-cta-section";
import { NewFooter } from "./_components/new-footer";

export default function HomePage() {
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
