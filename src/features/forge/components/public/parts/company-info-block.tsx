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
      ? "text-muted-foreground text-xs font-semibold uppercase tracking-widest"
      : "text-muted-foreground text-xs font-semibold uppercase tracking-widest";
  const cardCls =
    variant === "dark"
      ? "bg-card/60 border border-line"
      : "bg-white border border-line";
  const labelCls =
    variant === "dark" ? "text-muted-foreground text-[11px]" : "text-muted-foreground text-[11px]";
  const valueCls =
    variant === "dark" ? "text-foreground text-sm" : "text-foreground text-sm";
  const linkCls =
    variant === "dark"
      ? "text-[#a78bfa] hover:underline text-sm"
      : "text-info hover:underline text-sm";
  const bioCls =
    variant === "dark"
      ? "text-muted-foreground text-sm leading-relaxed"
      : "text-muted-foreground text-sm leading-relaxed";
  const iconCls = variant === "dark" ? "text-muted-foreground" : "text-muted-foreground";

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
