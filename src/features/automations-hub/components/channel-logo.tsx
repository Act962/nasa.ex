import { CircleCheckIcon } from "lucide-react";
import { WhatsappIcon } from "@/components/whatsapp";
import { FacebookIcon, InstagramIcon } from "@/features/tracking-chat/components/icons";
import { cn } from "@/lib/utils";

export type AutomationChannel = "whatsapp" | "instagram" | "facebook" | "workspace";

const CHANNEL_STYLE: Record<AutomationChannel, { label: string; className: string }> = {
  whatsapp: { label: "WhatsApp", className: "bg-brand-whatsapp text-white" },
  instagram: { label: "Instagram", className: "bg-brand-instagram text-white" },
  facebook: { label: "Facebook", className: "bg-brand-facebook text-white" },
  workspace: { label: "Workspace", className: "bg-info text-white" },
};

/** Logo redonda do canal de uma automação. */
export function ChannelLogo({ channel, className }: { channel: AutomationChannel; className?: string }) {
  const style = CHANNEL_STYLE[channel];
  return (
    <span
      title={style.label}
      aria-label={style.label}
      className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", style.className, className)}
    >
      {channel === "whatsapp" && <WhatsappIcon className="size-3.5" />}
      {channel === "instagram" && <InstagramIcon className="size-3.5" />}
      {channel === "facebook" && <FacebookIcon className="size-3.5" />}
      {channel === "workspace" && <CircleCheckIcon className="size-3.5" />}
    </span>
  );
}
