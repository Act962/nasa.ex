"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpacePoint } from "../hooks/use-space-point";
import { authClient } from "@/lib/auth-client";
import { MySealsTab }  from "./tabs/my-seals-tab";
import { MyRouteTab }  from "./tabs/my-route-tab";
import { RankingTab }  from "./tabs/ranking-tab";
import { SettingsTab } from "./tabs/settings-tab";

type Tab = "seals" | "route" | "ranking" | "settings";

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "seals",    label: "Meus Selos",      emoji: "🏅" },
  { key: "route",    label: "Minha Rota",       emoji: "🗺" },
  { key: "ranking",  label: "Ranking",          emoji: "🏆" },
  { key: "settings", label: "Configurações",    emoji: "⚙️" },
];

interface SpacePointModalProps {
  open: boolean;
  onClose: () => void;
}

export function SpacePointModal({ open, onClose }: SpacePointModalProps) {
  const [tab, setTab] = useState<Tab>("seals");
  const [mounted, setMounted] = useState(false);
  const { data: sp, isLoading } = useSpacePoint();
  const { data: session } = authClient.useSession();

  useEffect(() => { setMounted(true); }, []);

  if (!open || !mounted) return null;

  const earnedSet = new Set((sp?.seals ?? []).map((s) => s.levelId));

  const modal = (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-[95vw] sm:w-[70vw] max-h-[92vh] flex flex-col rounded-3xl bg-[#0d0d1a] border border-[#7a1fe7]/25 shadow-2xl overflow-hidden" style={{ zIndex: 10000 }}>

        {/* ── Header ── */}
        <div className="relative flex items-center gap-3 px-5 py-4 border-b border-[#7a1fe7]/15 bg-gradient-to-r from-[#7a1fe7]/15 to-transparent shrink-0">
          <Image
            src="/space-point/icon.svg"
            alt="Space Point"
            width={32}
            height={32}
            className="shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-extrabold text-white tracking-tight">Space Point</h2>
            {!isLoading && sp && (
              <p className="text-[11px] text-[#a78bfa]">
                {sp.totalPoints.toLocaleString("pt-BR")} pts &middot;{" "}
                {sp.currentLevel ? `${sp.currentLevel.planetEmoji} ${sp.currentLevel.name}` : "Iniciante"}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex shrink-0 px-3 pt-3 gap-1 bg-[#0d0d1a]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 flex flex-col items-center py-2 px-1 rounded-xl text-[10px] font-semibold transition-all gap-0.5",
                tab === t.key
                  ? "bg-[#7a1fe7] text-white"
                  : "text-muted-foreground hover:bg-[#7a1fe7]/15 hover:text-foreground",
              )}
            >
              <span className="text-base leading-none">{t.emoji}</span>
              <span className="leading-tight text-center">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#7a1fe7]/30">
          {isLoading ? (
            <div className="flex flex-col gap-3 py-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {tab === "seals" && sp && (
                <MySealsTab
                  totalPoints={sp.totalPoints}
                  allLevels={sp.allLevels}
                  seals={sp.seals}
                />
              )}
              {tab === "route" && sp && (
                <MyRouteTab
                  totalPoints={sp.totalPoints}
                  allLevels={sp.allLevels}
                  earnedLevelIds={earnedSet}
                  currentLevel={sp.currentLevel}
                  progressPct={sp.progressPct}
                />
              )}
              {tab === "ranking" && (
                <RankingTab myUserId={session?.user.id} />
              )}
              {tab === "settings" && (
                <SettingsTab />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
