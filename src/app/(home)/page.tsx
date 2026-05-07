"use client";

import { authClient } from "@/lib/auth-client";
import { STYLES } from "./_components/styles";
import { HeroSection } from "./_components/sections/hero-section";
import { StatsSection } from "./_components/sections/stats-section";
import { NasaMethodSection } from "./_components/sections/nasa-method-section";
import { AppsSection } from "./_components/sections/apps-section";
import { AstroSection } from "./_components/sections/astro-section";
import { InsightsFeatureSection } from "./_components/sections/insights-feature-section";
import { IntegrationsMarquee } from "./_components/sections/integrations-marquee";
import { StarsInfoSection } from "./_components/sections/stars-info-section";
import { PlansPublicSection } from "./_components/sections/plans-public-section";
import { PatternsFeatureSection } from "./_components/sections/patterns-feature-section";
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
      <StatsSection />
      <NasaMethodSection />
      <AppsSection />
      <AstroSection />
      <InsightsFeatureSection isLoggedIn={isLoggedIn} />
      <IntegrationsMarquee />
      <StarsInfoSection isLoggedIn={isLoggedIn} />
      <PlansPublicSection isLoggedIn={isLoggedIn} />
      <PatternsFeatureSection isLoggedIn={isLoggedIn} />
      <AppsShowcaseSection isLoggedIn={isLoggedIn} />
      <SimulatorSection isLoggedIn={isLoggedIn} />
      <GamifiedRankingSection isLoggedIn={isLoggedIn} />
      <FinalCTASection isLoggedIn={isLoggedIn} />
      <NewFooter />
    </>
  );
}
