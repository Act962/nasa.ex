"use client";

import { useParams } from "next/navigation";
import { CalendarDaysIcon, MessageSquareIcon, SettingsIcon, ZapIcon } from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";

export function TrackingOrbitDock() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const trackingBase = `/tracking/${trackingId}`;

  useRegisterOrbitDock({
    leftItems: [
      { label: "Agendamentos", href: `${trackingBase}/appointments`, icon: <CalendarDaysIcon /> },
      { label: "Chat", href: `/tracking-chat?trackingId=${trackingId}`, icon: <MessageSquareIcon /> },
    ],
    rightItems: [
      { label: "Gatilhos", href: `${trackingBase}/workflows`, icon: <ZapIcon /> },
      { label: "Configurações", href: `${trackingBase}/settings`, icon: <SettingsIcon /> },
    ],
  });

  return null;
}
