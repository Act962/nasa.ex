"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Integration } from "@/types/integration";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketplaceContextType {
  // Installed set (persisted to localStorage)
  installedSlugs: Set<string>;
  isInstalled: (slug: string) => boolean;
  install: (slug: string) => void;
  uninstall: (slug: string) => void;

  // ASTRO integration
  astroOpen: boolean;
  setAstroOpen: (open: boolean) => void;
  pendingInstall: Integration | null;
  triggerAstroInstall: (integration: Integration) => void;
  clearPendingInstall: () => void;
}

const MarketplaceContext = createContext<MarketplaceContextType | null>(null);

const STORAGE_KEY = "nasa_marketplace_installed";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [installedSlugs, setInstalledSlugs] = useState<Set<string>>(new Set());
  const [astroOpen, setAstroOpen] = useState(false);
  const [pendingInstall, setPendingInstall] = useState<Integration | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        setInstalledSlugs(new Set(parsed));
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage whenever installedSlugs changes
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...installedSlugs]));
  }, [installedSlugs, hydrated]);

  const isInstalled = useCallback(
    (slug: string) => installedSlugs.has(slug),
    [installedSlugs],
  );

  const install = useCallback((slug: string) => {
    setInstalledSlugs((prev) => {
      const next = new Set(prev);
      next.add(slug);
      return next;
    });
    toast.success("Integração instalada com sucesso!", {
      icon: "🚀",
      description: "A integração está ativa e sincronizando.",
    });
  }, []);

  const uninstall = useCallback((slug: string) => {
    setInstalledSlugs((prev) => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });
    toast.info("Integração removida.", { icon: "🔌" });
  }, []);

  const triggerAstroInstall = useCallback((integration: Integration) => {
    setPendingInstall(integration);
    setAstroOpen(true);
  }, []);

  const clearPendingInstall = useCallback(() => {
    setPendingInstall(null);
  }, []);

  return (
    <MarketplaceContext.Provider
      value={{
        installedSlugs,
        isInstalled,
        install,
        uninstall,
        astroOpen,
        setAstroOpen,
        pendingInstall,
        triggerAstroInstall,
        clearPendingInstall,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMarketplace() {
  const ctx = useContext(MarketplaceContext);
  if (!ctx) throw new Error("useMarketplace must be used inside MarketplaceProvider");
  return ctx;
}
