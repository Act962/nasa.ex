import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PartnerStatus } from "@/generated/prisma/client";

/**
 * Server-side guard for /partner pages.
 * Verifica:
 *  - Sessão válida
 *  - Partner.status === ACTIVE (não SUSPENDED, não ELIGIBLE)
 *  - Aceite da versão ativa dos termos (caso contrário redireciona para /partner/aceitar-termos)
 */
export async function requirePartnerSession(opts: { skipTermsCheck?: boolean } = {}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      isSystemAdmin: true,
    },
  });
  if (!user) redirect("/sign-in");

  const partner = await prisma.partner.findUnique({
    where: { userId: user.id },
  });
  if (!partner) redirect("/home");
  if (partner.status === PartnerStatus.SUSPENDED) redirect("/home");
  if (partner.status !== PartnerStatus.ACTIVE) redirect("/home");

  if (!opts.skipTermsCheck) {
    const activeTerms = await prisma.partnerTermsVersion.findFirst({
      where: { isActive: true },
      orderBy: { effectiveAt: "desc" },
    });
    if (activeTerms && partner.acceptedTermsVersionId !== activeTerms.id) {
      redirect("/partner/aceitar-termos");
    }
  }

  return { session, user, partner };
}
