import { ModalProvider } from "@/components/providers/modal-provider";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { OnboardingGate } from "@/features/onboarding/components/onboarding-gate";

export default async function RouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompletedAt: true },
  });

  const needsOnboarding = !dbUser?.onboardingCompletedAt;

  return (
    <>
      <ModalProvider />
      <OnboardingGate needsOnboarding={needsOnboarding}>
        {children}
      </OnboardingGate>
    </>
  );
}
