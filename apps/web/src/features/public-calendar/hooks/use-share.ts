"use client";

import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export type SharePlatform =
  | "whatsapp"
  | "x"
  | "facebook"
  | "linkedin"
  | "copy"
  | "google"
  | "ics";

export function useShare() {
  return useMutation({
    ...orpc.public.calendar.generateShareToken.mutationOptions(),
  });
}
