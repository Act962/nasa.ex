"use client";

import { useEffect } from "react";
import { Download } from "lucide-react";
import {
  TemplateModern,
  TemplateClean,
  TemplateCorporate,
  TemplateBold,
  TemplatePremium,
  type TemplateId,
  type TemplateProposal,
} from "./proposal-templates";

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

// ─── Template router ──────────────────────────────────────────────────────────

function TemplateRouter({
  proposal,
  template,
  isExpired,
  isPaid,
  token,
  ecosystemLinks,
}: {
  proposal: TemplateProposal;
  template: TemplateId;
  isExpired: boolean;
  isPaid: boolean;
  token: string;
  ecosystemLinks: EcosystemLinks;
}) {
  const props = { proposal, isExpired, isPaid, token, ecosystemLinks };
  switch (template) {
    case "clean":     return <TemplateClean     {...props} />;
    case "corporate": return <TemplateCorporate {...props} />;
    case "bold":      return <TemplateBold      {...props} />;
    case "premium":   return <TemplatePremium   {...props} />;
    default:          return <TemplateModern    {...props} />;
  }
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

  const rawTemplate = (proposal.headerConfig as { template?: string } | null)?.template;
  const VALID: TemplateId[] = ["modern", "clean", "corporate", "bold", "premium"];
  const template: TemplateId = VALID.includes(rawTemplate as TemplateId)
    ? (rawTemplate as TemplateId)
    : "modern";

  // Document title = suggested PDF filename
  const docTitle = makeDocTitle(proposal.organization.name, proposal.title, proposal.number);
  useEffect(() => {
    const prev = document.title;
    document.title = docTitle;
    return () => { document.title = prev; };
  }, [docTitle]);

  const templateProposal: TemplateProposal = {
    ...proposal,
    createdAt: proposal.createdAt,
    responsibleName: proposal.responsibleName ?? null,
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
    <div className="relative">
      {/* Floating PDF button — hidden in print via .forge-pdf-btn */}
      <button
        onClick={() => window.print()}
        className="forge-pdf-btn fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xl shadow-purple-900/30 transition-all hover:scale-105 active:scale-95"
        title="Baixar PDF"
      >
        <Download className="size-4 shrink-0" />
        Baixar PDF
      </button>

      <TemplateRouter
        proposal={templateProposal}
        template={template}
        isExpired={isExpired}
        isPaid={isPaid}
        token={token}
        ecosystemLinks={ecosystemLinks}
      />
    </div>
  );
}
