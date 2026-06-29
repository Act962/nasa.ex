"use client";

import { useEffect, useRef } from "react";
import {
  playSoundNotification,
  useSoundNotificationSettings,
} from "@/features/tracking-settings/hooks/use-sound-notification";

/**
 * Monitors the total lead count for a tracking and plays a sound when
 * new leads arrive (count increases after the initial hydration).
 */
export function useLeadSoundAlert({
  trackingId,
  totalLeads,
}: {
  trackingId: string;
  totalLeads: number;
}) {
  const { settings } = useSoundNotificationSettings(trackingId);
  const prevCountRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip first render — we don't want to play sound on page load
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevCountRef.current = totalLeads;
      return;
    }

    const prev = prevCountRef.current ?? totalLeads;

    if (totalLeads > prev && settings.enabled) {
      playSoundNotification(settings);
    }

    prevCountRef.current = totalLeads;
  }, [totalLeads, settings]);
}
