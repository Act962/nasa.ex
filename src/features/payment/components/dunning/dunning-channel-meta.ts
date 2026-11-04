import { Mail, MessageSquare, Smartphone, type LucideIcon } from "lucide-react";

export const DUNNING_CHANNEL_META: Record<"EMAIL" | "WHATSAPP" | "SMS", { label: string; Icon: LucideIcon }> = {
  WHATSAPP: { label: "WhatsApp", Icon: MessageSquare },
  EMAIL: { label: "E-mail", Icon: Mail },
  SMS: { label: "SMS", Icon: Smartphone },
};
