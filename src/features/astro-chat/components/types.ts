import type { useAstroChatSites } from "../hooks/use-astro-chat-sites";

export type AstroChatSiteRow = ReturnType<typeof useAstroChatSites>["sites"][number];
