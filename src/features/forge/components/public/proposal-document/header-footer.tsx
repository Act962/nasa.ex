"use client";

import { Building2, Globe, Mail, MapPin, Phone } from "lucide-react";
import { useConstructUrl as constructUrl } from "@/hooks/use-construct-url";
import { NasaPoweredBy } from "../parts/nasa-powered-by";
import { proposalNumberLabel } from "./format";
import type { SectionProps } from "./types";

function CompanyMark({ proposal, onBrand }: Pick<SectionProps, "proposal"> & { onBrand: boolean }) {
  const logo = proposal.organization.logo;
  return (
    <div className="flex min-w-0 items-center gap-3">
      {logo ? (
        <span className={onBrand ? "rounded-xl bg-white/95 p-1.5" : ""}>
          <img src={constructUrl(logo)} alt={proposal.organization.name} className="h-10 max-w-36 object-contain" />
        </span>
      ) : null}
      <p className="truncate text-lg font-extrabold tracking-wide @xl:text-xl">{proposal.organization.name}</p>
    </div>
  );
}

/** Topo fixo: marca da empresa e número. Cada modelo tem o seu jeito (spec 0150, RF-1). */
export function DocumentHeader({ proposal, look }: SectionProps) {
  const number = `Nº ${proposalNumberLabel(proposal.number)}`;
  if (look.template === "classic") {
    return (
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-[var(--brand)] px-5 py-6 @3xl:px-10">
        <CompanyMark proposal={proposal} onBrand={false} />
        <div className="@xl:text-right">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--brand-text)]">Proposta comercial</p>
          <p className="text-sm text-neutral-500">{number}</p>
        </div>
      </header>
    );
  }
  if (look.template === "compact") {
    return (
      <header className="border-t-[6px] border-[var(--brand)] px-5 pt-5 @3xl:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CompanyMark proposal={proposal} onBrand={false} />
          <p className="text-sm font-semibold text-neutral-500">Proposta {number}</p>
        </div>
      </header>
    );
  }
  return (
    <header
      className="flex flex-wrap items-start justify-between gap-4 bg-[var(--brand)] px-5 pb-12 pt-6 text-[var(--brand-ink)] [clip-path:polygon(0_0,100%_0,100%_78%,0_100%)] @3xl:px-10 @3xl:pb-14"
    >
      <CompanyMark proposal={proposal} onBrand />
      <div className="@xl:text-right">
        <p className="text-base font-extrabold uppercase tracking-[0.12em] @xl:text-lg">Proposta comercial</p>
        <p className="text-sm opacity-80">{number}</p>
      </div>
    </header>
  );
}

export function DocumentTitle({ proposal, look }: SectionProps) {
  const isCompact = look.template === "compact";
  return (
    <div className={isCompact ? "pt-4" : "pt-6"}>
      <h1 className={`font-extrabold leading-tight tracking-tight text-neutral-900 ${isCompact ? "text-2xl" : "text-[1.7rem] @3xl:text-4xl"}`}>
        {proposal.title}
      </h1>
      {proposal.client ? (
        <p className="mt-1.5 text-lg font-semibold text-[var(--brand-text)]">Preparada para {proposal.client.name}</p>
      ) : null}
    </div>
  );
}

/** Rodapé fixo: dados da empresa e a assinatura da ÓRBITA. */
export function DocumentFooter({ proposal }: SectionProps) {
  const organization = proposal.organization;
  const place = [organization.addressLine, [organization.city, organization.state].filter(Boolean).join(" - ")].filter(Boolean).join(" · ");
  const contacts = [
    organization.cnpj ? { icon: Building2, text: `CNPJ ${organization.cnpj}` } : null,
    organization.contactPhone ? { icon: Phone, text: organization.contactPhone } : null,
    organization.contactEmail ? { icon: Mail, text: organization.contactEmail } : null,
    organization.website ? { icon: Globe, text: organization.website } : null,
    place ? { icon: MapPin, text: place } : null,
  ].filter((contact): contact is { icon: typeof Phone; text: string } => contact !== null);
  return (
    <footer className="mt-8 border-t border-neutral-200 px-5 py-6 @3xl:px-10">
      <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-start @3xl:justify-between">
        <p className="font-bold text-neutral-900">{organization.name}</p>
        {contacts.length > 0 ? (
          <ul className="grid gap-x-6 gap-y-1.5 text-sm text-neutral-600 @2xl:grid-cols-2">
            {contacts.map((contact) => (
              <li key={contact.text} className="flex min-w-0 items-center gap-2">
                <contact.icon className="size-4 shrink-0 text-[var(--brand-text)]" />
                <span className="break-words">{contact.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="mt-6">
        <NasaPoweredBy variant="light" />
      </div>
    </footer>
  );
}
