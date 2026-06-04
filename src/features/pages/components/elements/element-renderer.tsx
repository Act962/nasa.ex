"use client";

import type { DesignTokens, ElementBase, LinkTarget } from "../../types";
import { SectionHero } from "./sections/section-hero";
import { SectionFeatures } from "./sections/section-features";
import { SectionPricing } from "./sections/section-pricing";
import { SectionCta } from "./sections/section-cta";
import { SectionStats } from "./sections/section-stats";
import { SectionTestimonials } from "./sections/section-testimonials";
import { SectionFaq } from "./sections/section-faq";
import { SectionLogoCloud } from "./sections/section-logo-cloud";
import {
  AccordionBlock,
  CounterBlock,
  MarqueeBlock,
  TabsBlock,
} from "./interactive";
import { DataBoundBlock } from "./data-bound";

interface Props {
  element: ElementBase;
  readonly?: boolean;
  tokens?: DesignTokens;
}

export function ElementRenderer({ element, readonly = false, tokens }: Props) {
  const common = { width: "100%", height: "100%" };

  switch (element.type) {
    case "text": {
      const content = element.content as { text?: string } | undefined;
      const text =
        (content && typeof content === "object" && "content" in content)
          ? extractText(content as unknown)
          : typeof element.content === "string"
            ? (element.content as string)
            : "Texto";
      return (
        <div
          style={{
            ...common,
            color: (element.color as string) ?? "#0f172a",
            fontSize: (element.fontSize as number) ?? 16,
            fontFamily: `${(element.fontFamily as string) ?? "Inter"}, sans-serif`,
            fontWeight: (element.fontWeight as string) ?? "400",
            lineHeight: (element.lineHeight as number) ?? 1.4,
            letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : undefined,
            textAlign: (element.align as "left" | "center" | "right" | "justify") ?? "left",
            fontStyle: element.italic ? "italic" : undefined,
            textDecoration: [
              element.underline ? "underline" : "",
              element.strikethrough ? "line-through" : "",
            ].filter(Boolean).join(" ") || undefined,
            backgroundColor: (element.textBg as string) || undefined,
            overflow: "hidden",
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </div>
      );
    }
    case "image": {
      const src = element.src as string;
      if (!src) {
        return (
          <div className="w-full h-full bg-muted/30 border border-dashed rounded flex items-center justify-center text-xs text-muted-foreground">
            Sem imagem
          </div>
        );
      }
      const imageOpacity = (element.imageOpacity as number) ?? 1;
      const colorOverlay = element.colorOverlay as string | undefined;
      const overlayOpacity = (element.overlayOpacity as number) ?? 0.5;
      const borderRadius = (element.borderRadius as number) ?? 0;
      const crop = element.crop as { x: number; y: number; w: number; h: number } | undefined;

      const imgStyle: React.CSSProperties = crop
        ? {
            position: "absolute",
            width: `${100 / crop.w}%`,
            height: `${100 / crop.h}%`,
            left: `${(-crop.x / crop.w) * 100}%`,
            top: `${(-crop.y / crop.h) * 100}%`,
            opacity: imageOpacity,
            display: "block",
          }
        : {
            width: "100%",
            height: "100%",
            objectFit: (element.fit as "cover" | "contain" | "fill" | "none") ?? "cover",
            display: "block",
            opacity: imageOpacity,
          };

      return (
        <div style={{ ...common, position: "relative", borderRadius, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={(element.alt as string) ?? ""} style={imgStyle} />
          {colorOverlay && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: colorOverlay,
                opacity: overlayOpacity,
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      );
    }
    case "shape": {
      const shape = (element.shape as string) ?? "rect";
      const fill = (element.fill as string) ?? "#6366f1";
      const stroke = element.stroke as string | undefined;
      const strokeWidth = (element.strokeWidth as number) ?? 1;
      if (shape === "triangle") {
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon
              points="50,0 100,100 0,100"
              fill={fill}
              stroke={stroke ?? "none"}
              strokeWidth={stroke ? strokeWidth : 0}
            />
          </svg>
        );
      }
      if (shape === "star") {
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon
              points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35"
              fill={fill}
              stroke={stroke ?? "none"}
              strokeWidth={stroke ? strokeWidth : 0}
            />
          </svg>
        );
      }
      if (shape === "hexagon") {
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon
              points="50,0 100,25 100,75 50,100 0,75 0,25"
              fill={fill}
              stroke={stroke ?? "none"}
              strokeWidth={stroke ? strokeWidth : 0}
            />
          </svg>
        );
      }
      return (
        <div
          style={{
            ...common,
            background: fill,
            borderRadius: shape === "ellipse" ? "50%" : (element.borderRadius as number) ?? 0,
            border: stroke ? `${strokeWidth}px solid ${stroke}` : undefined,
          }}
        />
      );
    }
    case "divider": {
      return (
        <div
          style={{
            background: (element.color as string) ?? "#94a3b8",
            width: "100%",
            height: "100%",
          }}
        />
      );
    }
    case "button": {
      const label = (element.label as string) ?? "Clique";
      const hrefAttrs = resolveLink(element.link as LinkTarget | undefined);
      return (
        <a
          {...hrefAttrs}
          style={{
            ...common,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: (element.bg as string) ?? "#6366f1",
            color: (element.fg as string) ?? "#fff",
            borderRadius: (element.radius as number) ?? 10,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {label}
        </a>
      );
    }
    case "video": {
      const url = element.url as string;
      if (!url) {
        return (
          <div className="w-full h-full bg-muted/30 border border-dashed rounded flex items-center justify-center text-xs text-muted-foreground">
            Sem URL de vídeo
          </div>
        );
      }
      const provider = element.provider as string;
      const src = provider === "yt" ? toYoutubeEmbed(url) : url;
      return (
        <iframe
          src={src}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ ...common, border: 0 }}
        />
      );
    }
    case "social": {
      const platforms = (element.platforms as string[]) ?? [];
      return (
        <div
          style={{ display: "flex", gap: (element.gap as number) ?? 8, alignItems: "center" }}
        >
          {platforms.map((p) => (
            <div
              key={p}
              style={{
                width: element.size as number,
                height: element.size as number,
                borderRadius: "50%",
                background: (element.iconColor as string) ?? "#0f172a",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {p.charAt(0)}
            </div>
          ))}
        </div>
      );
    }
    case "nasa-link": {
      const label = (element.label as string) ?? "Link NASA";
      const appId = (element.appId as string) ?? "tracking";
      const hrefAttrs = readonly
        ? { href: nasaLinkHref(appId, element.resourceId as string | undefined), target: "_blank" as const, rel: "noreferrer" as const }
        : { href: "#", onClick: (e: React.MouseEvent) => e.preventDefault() };
      return (
        <a
          {...hrefAttrs}
          style={{
            ...common,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 12,
            borderRadius: 12,
            background: (element.bg as string) ?? "#ffffff",
            color: (element.fg as string) ?? "#0f172a",
            textDecoration: "none",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#6366f1",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {appId.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{appId}</div>
          </div>
        </a>
      );
    }
    case "embed": {
      const html = (element.html as string) ?? "";
      return (
        <div
          style={common}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    case "spacer":
      return <div style={common} />;
    case "icon": {
      return (
        <div
          style={{
            ...common,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: (element.color as string) ?? "#6366f1",
            fontSize: Math.min(element.w, element.h),
          }}
        >
          ★
        </div>
      );
    }
    case "svg": {
      const src = element.src as string;
      return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={common} />
      ) : (
        <div className="w-full h-full bg-muted/30 border border-dashed rounded flex items-center justify-center text-xs text-muted-foreground">
          Sem SVG
        </div>
      );
    }
    // ── Sections completas (Fase 1) ──────────────────────────────
    case "section-hero":
      return <SectionHero element={element} tokens={tokens} readonly={readonly} />;
    case "section-features":
      return <SectionFeatures element={element} tokens={tokens} readonly={readonly} />;
    case "section-pricing":
      return <SectionPricing element={element} tokens={tokens} readonly={readonly} />;
    case "section-cta":
      return <SectionCta element={element} tokens={tokens} readonly={readonly} />;
    case "section-stats":
      return <SectionStats element={element} tokens={tokens} readonly={readonly} />;
    case "section-testimonials":
      return <SectionTestimonials element={element} tokens={tokens} readonly={readonly} />;
    case "section-faq":
      return <SectionFaq element={element} tokens={tokens} readonly={readonly} />;
    case "section-logo-cloud":
      return <SectionLogoCloud element={element} tokens={tokens} readonly={readonly} />;
    // ── Blocos interativos (Fase 2) ──────────────────────────────
    case "marquee":
      return <MarqueeBlock element={element} tokens={tokens} readonly={readonly} />;
    case "tabs":
      return <TabsBlock element={element} tokens={tokens} readonly={readonly} />;
    case "accordion":
      return <AccordionBlock element={element} tokens={tokens} readonly={readonly} />;
    case "counter":
      return <CounterBlock element={element} tokens={tokens} readonly={readonly} />;
    // ── Data binding (Fase 5) ────────────────────────────────────
    case "data-bound":
      return <DataBoundBlock element={element} tokens={tokens} readonly={readonly} />;
    default:
      return null;
  }
}

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (Array.isArray(n.content)) return n.content.map(extractText).join(" ");
  return "";
}

function resolveLink(link: LinkTarget | undefined) {
  if (!link) return { href: "#" };
  const href = link.kind === "url"
    ? link.href ?? "#"
    : nasaLinkHref(link.kind, link.resourceId);
  return {
    href,
    target: link.openInNewTab ? ("_blank" as const) : undefined,
    rel: link.openInNewTab ? ("noreferrer" as const) : undefined,
  };
}

function nasaLinkHref(kind: string, resourceId?: string) {
  switch (kind) {
    case "tracking": return resourceId ? `/tracking/${resourceId}` : "/tracking";
    case "form":     return resourceId ? `/submit-form/${resourceId}` : "/form";
    case "agenda":   return resourceId ? `/agenda/${resourceId}` : "/agendas";
    case "linnker":  return resourceId ? `/l/${resourceId}` : "/linnker";
    case "chat":     return "/tracking-chat";
    case "payment":  return "/payment";
    case "forge":    return resourceId ? `/forge/${resourceId}` : "/forge";
    case "page":     return resourceId ? `/s/${resourceId}` : "/pages";
    default:         return "#";
  }
}

function toYoutubeEmbed(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}
