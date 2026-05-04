"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { orpc } from "@/lib/orpc";

const PATH_RULES: Array<{ pattern: RegExp; appSlug: string; resourceFrom?: number }> = [
  { pattern: /^\/tracking(?:\/([^/]+))?/, appSlug: "tracking", resourceFrom: 1 },
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
  return { appSlug: "system" as string, resource: undefined as string | undefined };
}

export function HeartbeatProvider() {
  const pathname = usePathname();
  useEffect(() => {
    const sendHeartbeat = () => {
      const { appSlug, resource } = resolveAppSlugFromPath(pathname ?? "");
      orpc.activity.heartbeat
        .call({
          activeAppSlug: appSlug,
          activePath: pathname ?? "",
          activeResource: resource,
        })
        .catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30_000);
    return () => clearInterval(interval);
  }, [pathname]);
  return null;
}
