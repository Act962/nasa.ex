"use client";

import { useEffect } from "react";
import { resolveProposalLook } from "@/features/forge/lib/proposal-look";
import { ProposalDocument } from "./proposal-document/proposal-document";
import type { DocumentProposal, SimulationBreakdown } from "./proposal-document/types";

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
    proposalTemplate?: string | null;
    brandColor?: string | null;
    accentColor?: string | null;
    proposalSections?: unknown;
    paymentMethods?: unknown;
    commercialTerms?: string | null;
  } | null;
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
}: {
  proposal: Proposal;
  token: string;
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
    (proposal.headerConfig as { simulationBreakdown?: SimulationBreakdown } | null)?.simulationBreakdown ?? null;

  const organization = proposal.organization;
  const documentProposal: DocumentProposal = {
    title: proposal.title,
    number: proposal.number,
    status: proposal.status,
    description: proposal.description,
    validUntil: proposal.validUntil,
    createdAt: proposal.createdAt,
    discount: proposal.discount,
    discountType: proposal.discountType,
    paymentLink: proposal.paymentLink,
    breakdown,
    products: proposal.products,
    organization: {
      name: organization.name,
      logo: proposal.settings?.logoUrl ?? organization.logo,
      cnpj: organization.cnpj ?? null,
      contactEmail: organization.contactEmail ?? null,
      contactPhone: organization.contactPhone ?? null,
      addressLine: organization.addressLine ?? null,
      city: organization.city ?? null,
      state: organization.state ?? null,
      website: organization.website ?? null,
    },
    client: proposal.client
      ? { name: proposal.client.name, email: proposal.client.email, phone: proposal.client.phone, document: proposal.client.document ?? null }
      : null,
    responsible: proposal.responsible ? { name: proposal.responsible.name, image: proposal.responsible.image } : null,
  };

  return (
    <ProposalDocument
      proposal={documentProposal}
      look={resolveProposalLook(proposal.settings)}
      state={{ isExpired, isPaid, token, isPreview: false }}
    />
  );
}
