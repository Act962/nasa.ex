import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  TrafegoLanding,
  type ReturningCustomerDefaults,
} from "@/features/trafego/components/public/trafego-landing";

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
        const previous = await prisma.trafegoOrder.findFirst({
          where: {
            organizationId,
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
            organization: { select: { name: true } },
          },
        });

        if (previous) {
          const userPhone = (
            session.user as typeof session.user & { phone?: string | null }
          ).phone;
          repeatDefaults = {
            organizationId,
            organizationName: previous.organization.name,
            sourceOrderCode: previous.code,
            platform: previous.platform,
            campaignType: previous.campaignType,
            objective: previous.objective,
            socialHandle: previous.socialHandle ?? "",
            hasBusinessManager: businessManagerAnswer(
              previous.hasBusinessManager,
            ),
            officialAnswer: officialNumberAnswer(previous.hasOfficialNumber),
            officialNumber: previous.officialNumber ?? "",
            business: {
              businessName: previous.businessName ?? previous.organization.name,
              segment: previous.businessNiche ?? "",
              destinationUrl: previous.destinationUrl ?? "",
              audienceNotes: previous.targetAudience ?? "",
            },
            timing: {
              hasSocialLinked: previous.hasSocialLinked,
              materialsReady: previous.materialsReady,
            },
            contact: {
              fullName: session.user.name,
              email: session.user.email,
              phone: previous.whatsappNumber ?? userPhone ?? "",
              referralSource: "",
            },
            phoneVerified: Boolean(previous.phoneVerifiedAt),
          };
        }
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
