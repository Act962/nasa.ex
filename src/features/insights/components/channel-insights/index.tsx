"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MetaInsights } from "./meta-insights";
import { useQueryPlatformIntegrations } from "@/features/integrations/hooks/use-integrations";
import { useMarketplace } from "@/features/integrations/context/marketplace-context";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

// ─── Channel Icons ────────────────────────────────────────────────────────────

const MetaIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 00.265.86 5.297 5.297 0 00.371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.18.291l2.308 3.597c.924 1.44 1.977 2.754 3.236 3.66 1.416 1.03 2.92 1.436 4.558 1.436 1.724 0 3.345-.539 4.421-1.57.966-.927 1.548-2.216 1.548-3.793 0-2.89-1.386-5.553-3.5-7.577-2.071-1.982-5.131-3.502-9.063-3.502-3.244 0-5.906.905-7.944 2.362" />
  </svg>
);
const WhatsAppIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
const InstagramIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);
const TikTokIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.74a4.85 4.85 0 01-1.02-.05z" />
  </svg>
);
const LinkedInIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);
const GmailIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.907 1.528-1.147C21.69 2.28 24 3.434 24 5.457z" />
  </svg>
);
const GoogleMapsIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C7.802 0 4 3.403 4 7.602 4 11.8 7.469 16.812 12 24c4.531-7.188 8-12.2 8-16.398C20 3.403 16.199 0 12 0zm0 11a3 3 0 110-6 3 3 0 010 6z" />
  </svg>
);

// ─── Channel Definitions ──────────────────────────────────────────────────────

type ChannelId = "meta" | "whatsapp" | "instagram" | "tiktok" | "linkedin" | "gmail" | "google_maps";

interface ChannelDef {
  id: ChannelId;
  label: string;
  icon: React.FC;
  color: string;
  bg: string;
  activeBg: string;
  activeBorder: string;
  available: boolean;
  integrationKey?: string; // maps to IntegrationPlatform enum value
  slug?: string;           // maps to marketplace integration slug
  iconUrl?: string;        // clearbit logo URL matching the marketplace card
}

const CHANNELS: ChannelDef[] = [
  {
    id: "meta", label: "Meta Ads", icon: MetaIcon,
    color: "text-[#0082FB]", bg: "bg-[#0082FB]/10",
    activeBg: "bg-[#0082FB]", activeBorder: "border-[#0082FB]",
    available: true, integrationKey: "META",
    slug: "facebook-messenger", iconUrl: "https://logo.clearbit.com/meta.com",
  },
  {
    id: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon,
    color: "text-[#25D366]", bg: "bg-[#25D366]/10",
    activeBg: "bg-[#25D366]", activeBorder: "border-[#25D366]",
    available: false,
    slug: "whatsapp-business", iconUrl: "https://logo.clearbit.com/whatsapp.com",
  },
  {
    id: "instagram", label: "Instagram", icon: InstagramIcon,
    color: "text-[#E1306C]", bg: "bg-[#E1306C]/10",
    activeBg: "bg-[#E1306C]", activeBorder: "border-[#E1306C]",
    available: false, integrationKey: "INSTAGRAM",
    slug: "instagram-dm", iconUrl: "https://logo.clearbit.com/instagram.com",
  },
  {
    id: "tiktok", label: "TikTok", icon: TikTokIcon,
    color: "text-foreground", bg: "bg-muted",
    activeBg: "bg-foreground", activeBorder: "border-foreground",
    available: false, integrationKey: "TIKTOK",
    iconUrl: "https://logo.clearbit.com/tiktok.com",
  },
  {
    id: "linkedin", label: "LinkedIn", icon: LinkedInIcon,
    color: "text-[#0A66C2]", bg: "bg-[#0A66C2]/10",
    activeBg: "bg-[#0A66C2]", activeBorder: "border-[#0A66C2]",
    available: false, integrationKey: "LINKEDIN",
    iconUrl: "https://logo.clearbit.com/linkedin.com",
  },
  {
    id: "gmail", label: "E-mail", icon: GmailIcon,
    color: "text-[#EA4335]", bg: "bg-[#EA4335]/10",
    activeBg: "bg-[#EA4335]", activeBorder: "border-[#EA4335]",
    available: false, integrationKey: "GMAIL",
    iconUrl: "https://logo.clearbit.com/gmail.com",
  },
  {
    id: "google_maps", label: "Google Maps", icon: GoogleMapsIcon,
    color: "text-[#4285F4]", bg: "bg-[#4285F4]/10",
    activeBg: "bg-[#4285F4]", activeBorder: "border-[#4285F4]",
    available: false, integrationKey: "GOOGLE_MAPS",
    iconUrl: "https://logo.clearbit.com/maps.google.com",
  },
];

// ─── Channel Icon (with clearbit logo + SVG fallback) ─────────────────────────

function ChannelIcon({ channel, size = "sm" }: { channel: ChannelDef; size?: "sm" | "md" }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const sz = size === "sm" ? "w-5 h-5" : "w-8 h-8";
  const Icon = channel.icon;

  if (!channel.iconUrl) {
    return <Icon />;
  }

  return (
    <span className={cn("relative shrink-0 inline-flex items-center justify-center", sz)}>
      <span className={cn("absolute inset-0 flex items-center justify-center", imgLoaded && !imgFailed && "opacity-0")}>
        <Icon />
      </span>
      {!imgFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={channel.iconUrl}
          alt={channel.label}
          className={cn("absolute inset-0 w-full h-full object-contain rounded transition-opacity duration-200", imgLoaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />
      )}
    </span>
  );
}

// ─── Coming Soon Content ──────────────────────────────────────────────────────

function ComingSoon({ channel }: { channel: ChannelDef }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", channel.bg)}>
        <span className={channel.color}><ChannelIcon channel={channel} size="md" /></span>
      </div>
      <div>
        <Badge variant="outline" className="mb-2 text-xs">Em breve</Badge>
        <h3 className="font-semibold">Insights de {channel.label}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Esta integração está em desenvolvimento. Configure a integração agora para que os dados comecem a ser coletados assim que ficar disponível.
        </p>
      </div>
      {channel.integrationKey && (
        <Link href="/integrations" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
          Configurar integração <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ChannelInsights() {
  const [activeChannel, setActiveChannel] = useState<ChannelId>("meta");
  const { data: integrationsData } = useQueryPlatformIntegrations();
  const { isInstalled } = useMarketplace();

  const backendConnectedSet = new Set(
    (integrationsData?.integrations ?? []).filter((i) => i.isActive).map((i) => i.platform),
  );

  // A channel is connected if installed via marketplace OR via backend API
  const isChannelConnected = (ch: ChannelDef) => {
    if (ch.slug && isInstalled(ch.slug)) return true;
    if (ch.integrationKey && backendConnectedSet.has(ch.integrationKey as any)) return true;
    return false;
  };

  const activeChannelDef = CHANNELS.find((c) => c.id === activeChannel)!;

  return (
    <div className="space-y-6">
      {/* Channel selector */}
      <div>
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
          Selecione o canal
        </p>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((ch) => {
            const isActive = activeChannel === ch.id;
            const isConnected = isChannelConnected(ch);

            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-medium",
                  isActive
                    ? `${ch.activeBorder} text-white ${ch.activeBg} shadow-md`
                    : `border-border hover:border-muted-foreground/40 ${ch.bg} ${ch.color}`,
                )}
              >
                <ChannelIcon channel={ch} />
                <span className={cn(isActive ? "text-white" : "")}>{ch.label}</span>
                {/* Connected indicator */}
                {isConnected && !isActive && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                )}
                {!ch.available && (
                  <Badge variant="outline" className={cn(
                    "ml-1 text-[10px] h-4 px-1",
                    isActive ? "border-white/30 text-white bg-white/20" : "",
                  )}>
                    Em breve
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Channel content */}
      <div className="min-h-[400px]">
        {activeChannel === "meta" && <MetaInsights />}
        {activeChannel !== "meta" && <ComingSoon channel={activeChannelDef} />}
      </div>
    </div>
  );
}
