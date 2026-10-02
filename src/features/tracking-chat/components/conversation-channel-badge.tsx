import { MailIcon, GlobeIcon } from "lucide-react";
import { WhatsappIcon } from "@/components/whatsapp";
import { AstroMark } from "@/features/astro/components/astro-mark";
import { cn } from "@/lib/utils";
import { FacebookIcon, InstagramIcon } from "./icons";

// Selo do canal no canto do avatar: por onde a conversa chega. O canal da
// conversa (Instagram/Facebook) vence; sem ele, vale a origem do lead —
// ASTRO CHAT, chat do site e e-mail não são canais no banco.

interface ConversationChannelBadgeProps {
  channel?: string | null;
  leadSource?: string | null;
  className?: string;
}

function ChannelGlyph({ channel, leadSource }: ConversationChannelBadgeProps) {
  if (channel === "INSTAGRAM") return <InstagramIcon className="size-full text-brand-instagram" />;
  if (channel === "FACEBOOK") return <FacebookIcon className="size-full text-brand-facebook" />;
  if (leadSource === "ASTRO_CHAT") {
    return (
      <span className="flex size-full items-center justify-center rounded-full bg-info p-[1px]">
        <AstroMark className="size-full" />
      </span>
    );
  }
  if (leadSource === "IN_CHAT") return <GlobeIcon className="size-full text-info" />;
  if (leadSource === "GMAIL") return <MailIcon className="size-full text-destructive" />;
  return <WhatsappIcon className="size-full text-brand-whatsapp" />;
}

export function ConversationChannelBadge({ channel, leadSource, className }: ConversationChannelBadgeProps) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-0 left-0 z-10 flex size-[18px] items-center justify-center rounded-full bg-background p-[2px] ring-2 ring-background",
        className,
      )}
    >
      <ChannelGlyph channel={channel} leadSource={leadSource} />
    </span>
  );
}
