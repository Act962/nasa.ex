"use client";

import { toast } from "sonner";
import {
  MessageCircle,
  Twitter,
  Facebook,
  Linkedin,
  Link2,
  CalendarPlus,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShare, type SharePlatform } from "../hooks/use-share";
import {
  buildShareText,
  buildShareUrl,
  buildGoogleCalendarUrl,
} from "../utils/share-text";
import type { PublicEvent } from "../types";

interface ShareButtonsProps {
  event: PublicEvent;
}

const BUTTON_META: Record<
  SharePlatform,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    className: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20",
  },
  x: {
    label: "Twitter / X",
    icon: Twitter,
    className: "bg-sky-500/10 text-sky-600 hover:bg-sky-500/20",
  },
  facebook: {
    label: "Facebook",
    icon: Facebook,
    className: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
  },
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    className: "bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20",
  },
  copy: {
    label: "Copiar link",
    icon: Link2,
    className: "bg-muted text-foreground hover:bg-muted/80",
  },
  google: {
    label: "Google Agenda",
    icon: CalendarPlus,
    className: "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20",
  },
  ics: {
    label: "Baixar .ics",
    icon: Calendar,
    className: "bg-violet-500/10 text-violet-600 hover:bg-violet-500/20",
  },
};

export function ShareButtons({ event }: ShareButtonsProps) {
  const share = useShare();

  const handleShare = async (platform: SharePlatform) => {
    if (!event.startDate) return;

    if (platform === "ics") {
      window.open(`/api/calendario/ics/${event.publicSlug}`, "_blank");
      return;
    }

    if (platform === "google") {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (typeof window !== "undefined" ? window.location.origin : "");
      const url = `${appUrl}/calendario/evento/${event.publicSlug}`;
      window.open(buildGoogleCalendarUrl(event as never, url), "_blank");
      return;
    }

    try {
      const res = await share.mutateAsync({
        slug: event.publicSlug,
        platform,
      });

      if (platform === "copy") {
        await navigator.clipboard.writeText(res.eventUrl);
        toast.success("Link copiado!");
        return;
      }

      const text = buildShareText(event as never, res.shortUrl);
      const url = buildShareUrl(platform, text, res.shortUrl);
      window.open(url, "_blank");
    } catch {
      toast.error("Erro ao gerar link de compartilhamento");
    }
  };

  const platforms: SharePlatform[] = [
    "whatsapp",
    "x",
    "facebook",
    "linkedin",
    "copy",
    "google",
    "ics",
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {platforms.map((p) => {
        const meta = BUTTON_META[p];
        const Icon = meta.icon;
        return (
          <Button
            key={p}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleShare(p)}
            className={`gap-1.5 ${meta.className}`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="text-xs">{meta.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
