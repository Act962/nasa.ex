"use client";

import {
  Calendar,
  Sparkles,
  Link2,
  GraduationCap,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "dark" | "light";

interface Links {
  agendaUrl: string | null;
  agendaLabel: string | null;
  spaceHomeUrl: string | null;
  linnkerUrl: string | null;
  nasaRouteUrl: string | null;
  nasaRouteCount: number;
}

export function EcosystemLinksBlock({
  links,
  variant = "dark",
}: {
  links: Links;
  variant?: Variant;
}) {
  const items: {
    href: string;
    icon: LucideIcon;
    title: string;
    subtitle: string;
    external?: boolean;
  }[] = [];

  if (links.agendaUrl) {
    items.push({
      href: links.agendaUrl,
      icon: Calendar,
      title: "Agendar reunião",
      subtitle: links.agendaLabel ?? "Veja horários disponíveis",
    });
  }
  if (links.spaceHomeUrl) {
    items.push({
      href: links.spaceHomeUrl,
      icon: Sparkles,
      title: "Conhecer a empresa",
      subtitle: "Visite a SpaceHome",
    });
  }
  if (links.nasaRouteUrl) {
    items.push({
      href: links.nasaRouteUrl,
      icon: GraduationCap,
      title: "Cursos disponíveis",
      subtitle:
        links.nasaRouteCount > 1
          ? `${links.nasaRouteCount} cursos`
          : "1 curso publicado",
    });
  }
  if (links.linnkerUrl) {
    items.push({
      href: links.linnkerUrl,
      icon: Link2,
      title: "Todos os links",
      subtitle: "Veja nosso Linnker",
    });
  }

  if (items.length === 0) return null;

  const titleCls =
    variant === "dark"
      ? "text-muted-foreground text-xs font-semibold uppercase tracking-widest"
      : "text-muted-foreground text-xs font-semibold uppercase tracking-widest";

  const cardCls =
    variant === "dark"
      ? "bg-card/60 border border-line hover:border-[#7C3AED]/60 hover:bg-card"
      : "bg-white border border-line hover:border-info hover:shadow-md";

  const iconWrapCls =
    variant === "dark"
      ? "bg-[#7C3AED]/15 text-[#a78bfa]"
      : "bg-info/10 text-info";

  const itemTitleCls =
    variant === "dark"
      ? "text-white text-sm font-semibold"
      : "text-foreground text-sm font-semibold";

  const itemSubCls =
    variant === "dark" ? "text-muted-foreground text-xs" : "text-muted-foreground text-xs";

  const arrowCls = variant === "dark" ? "text-muted-foreground" : "text-muted-foreground";

  return (
    <div className="max-w-3xl mx-auto px-8 pb-8 forge-no-print">
      <p className={cn("text-center mb-4", titleCls)}>Explore também</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map(({ href, icon: Icon, title, subtitle }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "rounded-xl p-4 flex items-center gap-3 transition-all group",
              cardCls,
            )}
          >
            <div
              className={cn(
                "size-10 rounded-lg flex items-center justify-center shrink-0",
                iconWrapCls,
              )}
            >
              <Icon className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={itemTitleCls}>{title}</p>
              <p className={cn("truncate", itemSubCls)}>{subtitle}</p>
            </div>
            <ExternalLink
              className={cn(
                "size-4 shrink-0 group-hover:translate-x-0.5 transition-transform",
                arrowCls,
              )}
            />
          </a>
        ))}
      </div>
    </div>
  );
}
