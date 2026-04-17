import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PublicProposalView } from "@/features/forge/components/public/public-proposal";
import { ProposalViewTracker } from "@/features/forge/components/public/proposal-view-tracker";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicProposalPage({ params }: Props) {
  const { token } = await params;

  const proposal = await prisma.forgeProposal.findUnique({
    where: { publicToken: token },
    include: {
      organization: { select: { id: true, name: true, logo: true } },
      client: { select: { id: true, name: true, email: true, phone: true } },
      // Include the responsible person for the PDF footer
      responsible: { select: { name: true } },
      products: {
        include: {
          product: {
            select: { id: true, name: true, unit: true, imageUrl: true, description: true },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!proposal) return notFound();

  const settings = await prisma.forgeSettings.findUnique({
    where: { organizationId: proposal.organizationId },
  });

  const serialized = {
    ...proposal,
    discount: proposal.discount?.toString() ?? null,
    validUntil: proposal.validUntil?.toISOString() ?? null,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
    // Responsible person name (for PDF footer)
    responsibleName: proposal.responsible?.name ?? null,
    // headerConfig is Prisma JsonValue; cast to the expected record shape
    headerConfig: (proposal.headerConfig ?? null) as Record<string, unknown> | null,
    products: proposal.products.map((pp) => ({
      ...pp,
      quantity: pp.quantity.toString(),
      unitValue: pp.unitValue.toString(),
      discount: pp.discount?.toString() ?? null,
    })),
    settings: settings
      ? {
          ...settings,
          commissionPercentage: settings.commissionPercentage.toString(),
          createdAt: settings.createdAt.toISOString(),
          updatedAt: settings.updatedAt.toISOString(),
        }
      : null,
  };

  return (
    <>
      <ProposalViewTracker
        token={token}
        responsibleId={proposal.responsibleId}
        createdById={proposal.createdById}
      />
      <PublicProposalView proposal={serialized} />
    </>
  );
}
