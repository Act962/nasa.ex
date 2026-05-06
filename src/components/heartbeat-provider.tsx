"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { orpc } from "@/lib/orpc";
import { pusherClient } from "@/lib/pusher";

const PATH_RULES: Array<{
  pattern: RegExp;
  appSlug: string;
  resourceFrom?: number;
}> = [
  {
    pattern: /^\/tracking(?:\/([^/]+))?/,
    appSlug: "tracking",
    resourceFrom: 1,
  },
  { pattern: /^\/chat(?:\/([^/]+))?/, appSlug: "chat", resourceFrom: 1 },
  { pattern: /^\/insights/, appSlug: "insights" },
  { pattern: /^\/forge/, appSlug: "forge" },
  { pattern: /^\/spacetime/, appSlug: "spacetime" },
  { pattern: /^\/agenda/, appSlug: "spacetime" },
  { pattern: /^\/contacts/, appSlug: "contacts" },
  { pattern: /^\/settings/, appSlug: "settings" },
  { pattern: /^\/integrations/, appSlug: "integrations" },
  { pattern: /^\/nasa-planner/, appSlug: "nasa-planner" },
  { pattern: /^\/planner/, appSlug: "nasa-planner" },
  { pattern: /^\/nasa-route/, appSlug: "nasa-route" },
  { pattern: /^\/route/, appSlug: "nasa-route" },
  { pattern: /^\/nasa-partner/, appSlug: "nasa-partner" },
  { pattern: /^\/partner/, appSlug: "nasa-partner" },
  { pattern: /^\/nasa-payment/, appSlug: "nasa-payment" },
  { pattern: /^\/payment/, appSlug: "nasa-payment" },
  { pattern: /^\/nasa-space-help/, appSlug: "nasa-space-help" },
  { pattern: /^\/space-help/, appSlug: "nasa-space-help" },
  { pattern: /^\/nbox/, appSlug: "nbox" },
  { pattern: /^\/linnker/, appSlug: "linnker" },
  { pattern: /^\/forms/, appSlug: "forms" },
  { pattern: /^\/workspace/, appSlug: "workspace" },
  { pattern: /^\/explorer/, appSlug: "explorer" },
  { pattern: /^\/spacehome/, appSlug: "spacehome" },
  { pattern: /^\/space\//, appSlug: "spacehome" },
  { pattern: /^\/station/, appSlug: "station" },
  { pattern: /^\/permissions/, appSlug: "permissions" },
];

function resolveAppSlugFromPath(pathname: string) {
  for (const rule of PATH_RULES) {
    const match = pathname.match(rule.pattern);
    if (match) {
      const resource = rule.resourceFrom ? match[rule.resourceFrom] : undefined;
      return { appSlug: rule.appSlug, resource };
    }
  }
  return {
    appSlug: "system" as string,
    resource: undefined as string | undefined,
  };
}

const INACTIVITY_THRESHOLD_MS = 30_000;

export function HeartbeatProvider() {
  const pathname = usePathname();
  const channelRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // Connect once on mount: register presence in DB and subscribe to presence channel.
  // The channel stays open for the entire session — Pusher handles online/offline
  // detection automatically without any polling interval.
  useEffect(() => {
    const { appSlug, resource } = resolveAppSlugFromPath(
      pathnameRef.current ?? "",
    );

    orpc.activity.connect
      .call({
        activeAppSlug: appSlug,
        activePath: pathnameRef.current ?? "",
        activeResource: resource,
      })
      .then(({ channelName }) => {
        channelRef.current = channelName;
        pusherClient.subscribe(channelName);
      })
      .catch(() => {});

    return () => {
      if (channelRef.current) {
        pusherClient.unsubscribe(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // intentionally empty — runs once per session

  // Update active app/path on navigation (debounced 3s to avoid spamming on
  // rapid route transitions).
  useEffect(() => {
    const { appSlug, resource } = resolveAppSlugFromPath(pathname ?? "");
    const timer = setTimeout(() => {
      orpc.activity.updateActivity
        .call({
          activeAppSlug: appSlug,
          activePath: pathname ?? "",
          activeResource: resource,
        })
        .catch(() => {});
    }, 3_000);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Track inactivity windows via Page Visibility API — no polling needed.
  // The duration is only computed when the user returns (state = visible),
  // so short tab switches under the threshold are silently ignored.
  useEffect(() => {
    let hiddenAt: number | null = null;

    function onVisibilityChange() {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        const dur = Date.now() - hiddenAt;
        hiddenAt = null;
        if (dur >= INACTIVITY_THRESHOLD_MS) {
          orpc.activity.logInactivity.call({ durationMs: dur }).catch(() => {});
        }
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return null;
}
