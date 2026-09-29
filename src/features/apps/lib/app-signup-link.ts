import { APPS } from "../components/apps-data";
import { SIDEBAR_NAV_ITEMS } from "./sidebar-items";

// Link próprio de cada app (spec 0042, RF-8 a RF-10): /app/<chave>.
export const APP_SIGNUP_COOKIE = "nasa_app";
export const APP_SIGNUP_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;
export const APP_LINK_PATH = "/app";

export type ResolvedAppLink = { sidebarKey: string | null; url: string; name: string };

/** Aceita a chave do menu (ex.: "campanhas") ou o id do catálogo de apps (ex.: "demand"). */
export function resolveAppLink(appKey: string): ResolvedAppLink | null {
  const navItem = SIDEBAR_NAV_ITEMS.find((item) => item.key === appKey);
  if (navItem) return { sidebarKey: navItem.key, url: navItem.url, name: navItem.title };
  const app = APPS.find((candidate) => candidate.id === appKey);
  if (!app) return null;
  const linkedNavItem = app.sidebarKey ? SIDEBAR_NAV_ITEMS.find((item) => item.key === app.sidebarKey) : undefined;
  if (linkedNavItem) return { sidebarKey: linkedNavItem.key, url: linkedNavItem.url, name: app.name };
  if (app.action === "internal" && app.href) return { sidebarKey: null, url: app.href, name: app.name };
  return null;
}

export function appLinkKeyOf(app: { id: string; sidebarKey?: string }): string {
  return app.sidebarKey ?? app.id;
}

export function readAppSignupCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${APP_SIGNUP_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") || null : null;
}

export function clearAppSignupCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${APP_SIGNUP_COOKIE}=; Max-Age=0; path=/`;
}
