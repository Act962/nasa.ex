import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PublicProposalView } from "@/features/forge/components/public/public-proposal";
import { ProposalViewTracker } from "@/features/forge/components/public/proposal-view-tracker";
import { renderTemplate, type RenderContext } from "@/features/forge/utils/render-template";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicProposalPage({ params }: Props) {
  const { token } = await params;

  const proposal = await prisma.forgeProposal.findUnique({
    where: { publicToken: token },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          cnpj: true,
          contactEmail: true,
          contactPhone: true,
          addressLine: true,
          city: true,
          state: true,
          postalCode: true,
          website: true,
          bio: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          document: true,
          profile: true,
        },
      },
      // Include the responsible person for the PDF footer + avatar
      responsible: { select: { id: true, name: true, image: true } },
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

  // ── Ecosystem links da org (best-effort, server-side) ──────────
  // Descobre quais integrações da empresa proposante exibir como CTAs
  // na proposta: agenda pública, SpaceHome, Linnker, NASA Route.
  const orgSlug = proposal.organization.slug;
  const [agenda, spaceStation, linnkerPage, courseCount] = await Promise.all([
    prisma.agenda.findFirst({
      where: { organizationId: proposal.organizationId, isActive: true },
      select: { slug: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.spaceStation.findFirst({
      where: {
        orgId: proposal.organizationId,
        type: "ORG",
        isPublic: true,
      },
      select: { nick: true },
    }),
    prisma.linnkerPage.findFirst({
      where: { organizationId: proposal.organizationId, isPublished: true },
      select: { slug: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.nasaRouteCourse.count({
      where: {
        creatorOrgId: proposal.organizationId,
        isPublished: true,
      },
    }),
  ]);

  const ecosystemLinks = {
    agendaUrl:
      agenda && orgSlug ? `/agenda/${orgSlug}/${agenda.slug}` : null,
    agendaLabel: agenda?.name ?? null,
    spaceHomeUrl: spaceStation?.nick
      ? `/space/${spaceStation.nick}`
      : null,
    linnkerUrl: linnkerPage ? `/l/${linnkerPage.slug}` : null,
    nasaRouteUrl: courseCount > 0 && orgSlug ? `/c/${orgSlug}` : null,
    nasaRouteCount: courseCount,
  };

  const ctx: RenderContext = {
    organization: {
      name: proposal.organization.name,
      cnpj: proposal.organization.cnpj ?? null,
      contactEmail: proposal.organization.contactEmail ?? null,
      contactPhone: proposal.organization.contactPhone ?? null,
      addressLine: proposal.organization.addressLine ?? null,
      city: proposal.organization.city ?? null,
      state: proposal.organization.state ?? null,
      postalCode: proposal.organization.postalCode ?? null,
    },
    client: proposal.client
      ? {
          name: proposal.client.name,
          email: proposal.client.email,
          document: proposal.client.document,
          phone: proposal.client.phone,
          address: null,
          contactName: null,
        }
      : null,
    contract: null,
    proposal: {
      number: proposal.number,
      title: proposal.title,
      validUntil: proposal.validUntil,
    },
  };

  const renderedDescription = renderTemplate(proposal.description ?? "", ctx);

  const serialized = {
    ...proposal,
    description: renderedDescription,
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
      <PublicProposalView
        proposal={serialized}
        token={token}
        ecosystemLinks={ecosystemLinks}
      />
    </>
  );
}
