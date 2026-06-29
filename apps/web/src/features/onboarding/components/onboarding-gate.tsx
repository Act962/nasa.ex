"use client";

import { useState } from "react";
import { OnboardingWizard } from "./onboarding-wizard";

export function OnboardingGate({
  needsOnboarding,
  children,
}: {
  needsOnboarding: boolean;
  children: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);

  return (
    <>
      {children}
      {needsOnboarding && !dismissed && (
        <OnboardingWizard onComplete={() => setDismissed(true)} />
      )}
    </>
  );
}
