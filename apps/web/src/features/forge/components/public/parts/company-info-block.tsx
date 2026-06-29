"use client";

import { Building2, Mail, Phone, MapPin, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "dark" | "light";

interface Org {
  name: string;
  cnpj?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  website?: string | null;
  bio?: string | null;
}

function formatAddress(org: Org) {
  const parts = [org.addressLine, org.city, org.state, org.postalCode].filter(
    Boolean,
  );
  return parts.join(", ");
}

export function CompanyInfoBlock({
  organization,
  variant = "dark",
}: {
  organization: Org;
  variant?: Variant;
}) {
  const address = formatAddress(organization);
  const items: { icon: typeof Mail; label: string; value: string; href?: string }[] = [];
  if (organization.cnpj)
    items.push({ icon: Building2, label: "CNPJ", value: organization.cnpj });
  if (organization.contactEmail)
    items.push({
      icon: Mail,
      label: "Email",
      value: organization.contactEmail,
      href: `mailto:${organization.contactEmail}`,
    });
  if (organization.contactPhone)
    items.push({
      icon: Phone,
      label: "Telefone",
      value: organization.contactPhone,
      href: `tel:${organization.contactPhone.replace(/\D/g, "")}`,
    });
  if (address) items.push({ icon: MapPin, label: "Endereço", value: address });
  if (organization.website)
    items.push({
      icon: Globe,
      label: "Website",
      value: organization.website,
      href: organization.website.startsWith("http")
        ? organization.website
        : `https://${organization.website}`,
    });

  if (items.length === 0 && !organization.bio) return null;

  const titleCls =
    variant === "dark"
      ? "text-slate-400 text-xs font-semibold uppercase tracking-widest"
      : "text-gray-500 text-xs font-semibold uppercase tracking-widest";
  const cardCls =
    variant === "dark"
      ? "bg-slate-900/60 border border-slate-800"
      : "bg-white border border-gray-200";
  const labelCls =
    variant === "dark" ? "text-slate-500 text-[11px]" : "text-gray-400 text-[11px]";
  const valueCls =
    variant === "dark" ? "text-slate-200 text-sm" : "text-gray-800 text-sm";
  const linkCls =
    variant === "dark"
      ? "text-[#a78bfa] hover:underline text-sm"
      : "text-blue-600 hover:underline text-sm";
  const bioCls =
    variant === "dark"
      ? "text-slate-300 text-sm leading-relaxed"
      : "text-gray-600 text-sm leading-relaxed";
  const iconCls = variant === "dark" ? "text-slate-500" : "text-gray-400";

  return (
    <div className="max-w-3xl mx-auto px-8 pb-8 forge-avoid-break">
      <p className={cn("text-center mb-4", titleCls)}>Sobre a empresa</p>
      <div className={cn("rounded-2xl p-6 space-y-4", cardCls)}>
        {organization.bio && <p className={bioCls}>{organization.bio}</p>}
        {items.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            {items.map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="flex items-start gap-3 min-w-0">
                <Icon className={cn("size-4 mt-0.5 shrink-0", iconCls)} />
                <div className="min-w-0">
                  <p className={labelCls}>{label}</p>
                  {href ? (
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className={cn("truncate block", linkCls)}
                    >
                      {value}
                    </a>
                  ) : (
                    <p className={cn("truncate", valueCls)}>{value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
