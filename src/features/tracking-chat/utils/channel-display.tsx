import { EllipsisIcon, GlobeIcon, MailIcon, ShoppingBasket, SparklesIcon } from "lucide-react";
import { WhatsappIcon } from "@/components/whatsapp";
import { CATALOG_CHANNEL_LABEL, type ChannelFilter } from "./channel-filter";

/** Nome curto do canal selecionado, mostrado no item "Canais" do dock. */
export const CHANNEL_LABEL: Record<ChannelFilter, string> = {
  ALL: "Canais",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  FACEBOOK: "Facebook",
  EMAIL: "E-mail",
  IN_CHAT: "Chat do site",
  ASTRO_CHAT: "ASTRO CHAT",
  CATALOG: CATALOG_CHANNEL_LABEL,
};

export function ChannelIcon({ channel }: { channel: ChannelFilter }) {
  if (channel === "WHATSAPP") return <WhatsappIcon className="size-4 text-brand-whatsapp" />;
  if (channel === "INSTAGRAM") return <span className="size-4 rounded-full bg-brand-instagram" />;
  if (channel === "FACEBOOK") return <span className="size-4 rounded-full bg-brand-messenger" />;
  if (channel === "EMAIL") return <MailIcon className="size-4" />;
  if (channel === "IN_CHAT") return <GlobeIcon className="size-4" />;
  if (channel === "ASTRO_CHAT") return <SparklesIcon className="size-4" />;
  if (channel === "CATALOG") return <ShoppingBasket className="size-4" />;
  return <EllipsisIcon className="size-4" />;
}
