"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useSetAtom } from "jotai";
import { lastTrackingIdAtom } from "@/features/trackings/lib/last-tracking";

/** Guarda o funil aberto como "o último", em qualquer tela dentro de /tracking/[trackingId]. */
export function RememberLastTracking() {
  const { trackingId } = useParams<{ trackingId?: string }>();
  const setLastTrackingId = useSetAtom(lastTrackingIdAtom);
  useEffect(() => {
    if (trackingId) setLastTrackingId(trackingId);
  }, [trackingId, setLastTrackingId]);
  return null;
}
