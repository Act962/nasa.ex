import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  TrafegoLanding,
  type ReturningCustomerDefaults,
} from "@/features/trafego/components/public/trafego-landing";
import { hasOrgPaidTrafegoSetup } from "@/features/trafego/server/lib/setup-fee";

interface SearchParams {
  cancelado?: string;
  nova?: string;
}

function businessManagerAnswer(value: boolean | null): "yes" | "no" | "unsure" {
  return value === null ? "unsure" : value ? "yes" : "no";
}

function officialNumberAnswer(value: boolean | null): "yes" | "no" | null {
  return value === null ? null : value ? "yes" : "no";
}

type SessionUser = { name: string; email: string; phone?: string | null };

/**
 * Sugestões para quem já é membro de uma org (spec 0123, RF-9/RF-10). Com pedido
 * anterior, reaproveita o que ele trouxe; sem pedido, contrata dentro da org ativa
 * do mesmo jeito. A Meta conectada e testada nos Satélites responde o que já sabemos.
 */
async function buildMemberDefaults(params: {
  organizationId: string;
  user: SessionUser;
}): Promise<ReturningCustomerDefaults | null> {
  const [organization, previous, metaIntegration, hasPaidSetup] = await Promise.all([
    prisma.organization.findUnique({ where: { id: params.organizationId }, select: { name: true } }),
    prisma.trafegoOrder.findFirst({
      where: {
        organizationId: params.organizationId,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        code: true,
        platform: true,
        campaignType: true,
        objective: true,
        businessName: true,
        businessNiche: true,
        targetAudience: true,
        destinationUrl: true,
        whatsappNumber: true,
        socialHandle: true,
        hasBusinessManager: true,
        hasOfficialNumber: true,
        officialNumber: true,
        hasSocialLinked: true,
        materialsReady: true,
        phoneVerifiedAt: true,
      },
    }),
    prisma.platformIntegration.findUnique({
      where: { organizationId_platform: { organizationId: params.organizationId, platform: "META" } },
      select: { isActive: true, config: true },
    }),
    hasOrgPaidTrafegoSetup(params.organizationId),
  ]);
  if (!organization) return null;

  const metaConfig = (metaIntegration?.config ?? null) as Record<string, unknown> | null;
  const connectionCheck = metaConfig?.connectionCheck as
    | { canRead?: boolean; pages?: { instagramUsername?: string | null }[] }
    | undefined;
  const isMetaConnected = Boolean(metaIntegration?.isActive && connectionCheck?.canRead);
  const connectedInstagram =
    connectionCheck?.pages?.find((page) => page.instagramUsername)?.instagramUsername ?? "";

  return {
    organizationId: params.organizationId,
    organizationName: organization.name,
    sourceOrderCode: previous?.code ?? null,
    platform: previous?.platform ?? null,
    campaignType: previous?.campaignType ?? null,
    objective: previous?.objective ?? null,
    isMetaConnected,
    hasPaidSetup,
    socialHandle: previous?.socialHandle || connectedInstagram,
    hasBusinessManager: isMetaConnected
      ? "yes"
      : businessManagerAnswer(previous?.hasBusinessManager ?? null),
    officialAnswer: officialNumberAnswer(previous?.hasOfficialNumber ?? null),
    officialNumber: previous?.officialNumber ?? "",
    business: {
      businessName: previous?.businessName ?? organization.name,
      segment: previous?.businessNiche ?? "",
      destinationUrl: previous?.destinationUrl ?? "",
      audienceNotes: previous?.targetAudience ?? "",
    },
    timing: {
      hasSocialLinked: isMetaConnected ? true : (previous?.hasSocialLinked ?? null),
      materialsReady: previous?.materialsReady ?? null,
    },
    contact: {
      fullName: params.user.name,
      email: params.user.email,
      phone: previous?.whatsappNumber ?? params.user.phone ?? "",
      referralSource: "",
    },
    phoneVerified: Boolean(previous?.phoneVerifiedAt),
  };
}

export default async function TrafegoPublicPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { cancelado, nova } = await searchParams;
  let repeatDefaults: ReturningCustomerDefaults | null = null;

  if (nova === "1") {
    const session = await auth.api.getSession({ headers: await headers() });
    const organizationId = session?.session.activeOrganizationId;

    if (session?.user && organizationId) {
      const membership = await prisma.member.findFirst({
        where: { userId: session.user.id, organizationId },
        select: { organizationId: true },
      });

      if (membership) {
        repeatDefaults = await buildMemberDefaults({
          organizationId,
          user: session.user as typeof session.user & { phone?: string | null },
        });
      }
    }
  }

  return (
    <TrafegoLanding
      wasCancelled={cancelado === "1"}
      repeatDefaults={repeatDefaults}
    />
  );
}
