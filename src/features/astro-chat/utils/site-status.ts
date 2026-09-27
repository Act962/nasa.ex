/** Rótulo do estado de um site do ASTRO CHAT (spec 0031, RF-12). */

export type SiteStatusTone = "active" | "warning" | "off";

export function describeSiteStatus(site: {
  isEnabled: boolean;
  pausedReason: string | null;
  trackingId: string | null;
  allowedOrigins: string[];
}): { label: string; tone: SiteStatusTone } {
  if (!site.isEnabled) return { label: "Desligado", tone: "off" };
  if (site.pausedReason === "no_stars") return { label: "Pausado — sem Stars", tone: "warning" };
  if (!site.trackingId) return { label: "Escolha um tracking", tone: "warning" };
  if (site.allowedOrigins.length === 0) return { label: "Cadastre um domínio", tone: "warning" };
  return { label: "No ar", tone: "active" };
}

export function buildInstallSnippet(appOrigin: string, publicKey: string): string {
  return `<script src="${appOrigin}/api/astro-chat/loader.js" data-key="${publicKey}" async></script>`;
}
