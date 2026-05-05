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

// Threshold mínimo pra registrar uma janela de inatividade (ms).
// Alinhado com o intervalo do heartbeat — abaixo disso é considerado
// troca rápida de aba/contexto, não inatividade real.
const INACTIVITY_THRESHOLD_MS = 30_000;

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

  // Captura "Tempo inativo": tempo com a aba escondida (outra tab, janela
  // minimizada, etc). Usa Page Visibility API ao invés de polling — event
  // listener não é throttled em background, e o cálculo da duração só roda
  // quando o usuário volta (estado `visible`), garantindo precisão.
  // Janelas < 30s são descartadas (provável troca rápida de aba/contexto).
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
          orpc.activity.logInactivity
            .call({ durationMs: dur })
            .catch(() => {});
        }
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return null;
}
