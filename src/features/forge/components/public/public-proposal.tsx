"use client";

import { useEffect } from "react";
import { TemplateModern, type TemplateProposal } from "./proposal-templates";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProposalProduct {
  id: string;
  quantity: string;
  unitValue: string;
  discount: string | null;
  description: string | null;
  product: {
    id: string;
    name: string;
    unit: string;
    imageUrl: string | null;
    description: string | null;
  };
}

interface Proposal {
  id: string;
  title: string;
  number: number;
  status: string;
  description: string | null;
  validUntil: string | null;
  createdAt: string;
  discount: string | null;
  discountType: string | null;
  paymentLink: string | null;
  responsibleName?: string | null;
  products: ProposalProduct[];
  organization: {
    id: string;
    name: string;
    slug: string | null;
    logo: string | null;
    cnpj?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    addressLine?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    website?: string | null;
    bio?: string | null;
  };
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    document?: string | null;
    profile?: string | null;
  } | null;
  responsible?: { id: string; name: string; image: string | null } | null;
  responsibleId?: string | null;
  headerConfig?: Record<string, unknown> | null;
  settings: {
    logoUrl: string | null;
    letterheadHeader: string | null;
    letterheadFooter: string | null;
    proposalBgColor: string;
  } | null;
}

export interface EcosystemLinks {
  agendaUrl: string | null;
  agendaLabel: string | null;
  spaceHomeUrl: string | null;
  linnkerUrl: string | null;
  nasaRouteUrl: string | null;
  nasaRouteCount: number;
}

// ─── Filename slug: OrgName_TituloProposita_0001 ──────────────────────────────

function makeDocTitle(org: string, title: string, number: number): string {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, "_");
  return `${slug(org)}_${slug(title)}_${String(number).padStart(4, "0")}`;
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PublicProposalView({
  proposal,
  token,
  ecosystemLinks,
}: {
  proposal: Proposal;
  token: string;
  ecosystemLinks: EcosystemLinks;
}) {
  const isExpired = proposal.validUntil
    ? new Date(proposal.validUntil) < new Date()
    : false;
  const isPaid = proposal.status === "PAGA";

  // Document title = suggested PDF filename
  const docTitle = makeDocTitle(
    proposal.organization.name,
    proposal.title,
    proposal.number,
  );
  useEffect(() => {
    const prev = document.title;
    document.title = docTitle;
    return () => {
      document.title = prev;
    };
  }, [docTitle]);

  const breakdown =
    (proposal.headerConfig as { simulationBreakdown?: TemplateProposal["breakdown"] } | null)
      ?.simulationBreakdown ?? null;

  const templateProposal: TemplateProposal = {
    ...proposal,
    breakdown,
    createdAt: proposal.createdAt,
    organization: {
      name: proposal.organization.name,
      logo: proposal.organization.logo,
      slug: proposal.organization.slug,
      cnpj: proposal.organization.cnpj ?? null,
      contactEmail: proposal.organization.contactEmail ?? null,
      contactPhone: proposal.organization.contactPhone ?? null,
      addressLine: proposal.organization.addressLine ?? null,
      city: proposal.organization.city ?? null,
      state: proposal.organization.state ?? null,
      postalCode: proposal.organization.postalCode ?? null,
      website: proposal.organization.website ?? null,
      bio: proposal.organization.bio ?? null,
    },
    client: proposal.client
      ? {
          name: proposal.client.name,
          email: proposal.client.email,
          phone: proposal.client.phone,
          document: proposal.client.document ?? null,
          profile: proposal.client.profile ?? null,
        }
      : null,
    responsible: proposal.responsible
      ? {
          name: proposal.responsible.name,
          image: proposal.responsible.image,
        }
      : null,
  };

  return (
    <div>
      <TemplateModern
        proposal={templateProposal}
        isExpired={isExpired}
        isPaid={isPaid}
        token={token}
        ecosystemLinks={ecosystemLinks}
      />
    </div>
  );
}
