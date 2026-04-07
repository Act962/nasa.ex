"use client";

import {
  createContext, useCallback, useContext, useRef, useState, useEffect,
} from "react";
import { toast } from "sonner";
import { AchievementPopup, type AchievementData } from "./achievement-popup";
import { useEarnSpacePoints, useSpacePoint } from "../hooks/use-space-point";

interface PopupTemplateData {
  name: string;
  title: string;
  message: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  enableConfetti: boolean;
  enableSound: boolean;
  dismissDuration: number;
  customJson?: Record<string, unknown>;
  type: string;
}

interface SpacePointCtx {
  earn: (action: string, description?: string, metadata?: Record<string, unknown>) => Promise<void>;
}
const SpacePointContext = createContext<SpacePointCtx>({ earn: async () => {} });
export const useSpacePointCtx = () => useContext(SpacePointContext);

export function SpacePointProvider({ children }: { children: React.ReactNode }) {
  const [achievement, setAchievement] = useState<AchievementData | null>(null);
  const [popupTemplates, setPopupTemplates] = useState<PopupTemplateData[]>([]);
  const { mutateAsync: earnMutation } = useEarnSpacePoints();
  const { data: sp } = useSpacePoint();

  useEffect(() => {
    fetch("/api/admin/popup-templates")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setPopupTemplates(data))
      .catch(() => {});
  }, []);

  const getTemplate = (type: string): PopupTemplateData | undefined =>
    popupTemplates.find((t) => t.type === type) ?? popupTemplates[0];
  const prevProgressRef   = useRef<number | null>(null);
  const notifiedNearRef   = useRef(false);
  const dailyLoginFired   = useRef(false);
  const active30minFired  = useRef(false);
  const active2hFired     = useRef(false);
  const sessionStartRef   = useRef<number>(Date.now());

  // ── Earn helper ────────────────────────────────────────────────────────────
  const earn = useCallback(async (
    action: string, description?: string, metadata?: Record<string, unknown>,
  ) => {
    try {
      const result = await earnMutation({ action, description, metadata });
      if (!result.awarded) return;

      if (result.newSeals.length > 0) {
        const seal = result.newSeals[result.newSeals.length - 1];
        const tpl = getTemplate("level_up");
        setAchievement({
          type:        "level_up",
          title:       `Você chegou a ${seal.name}!`,
          message:     `Parabéns! Você desbloqueou ${seal.planetEmoji} ${seal.name}. Continue explorando o NASA!`,
          badgeNumber: seal.badgeNumber,
          badgeUrl:    seal.badgeUrl,
          planetEmoji: seal.planetEmoji,
          template:    tpl as AchievementData["template"],
          vars: {
            nova_conquista:          seal.name,
            quantidade_stars:        String(result.awarded ?? 0),
            quantidade_space_points: String(sp?.totalPoints ?? 0),
            nome_plano:              sp?.currentLevel?.name ?? "",
            meu_ranking:             "",
          },
        });
      } else {
        toast(`+${result.awarded} pts ✨`, { duration: 2500 });
      }
    } catch { /* silently fail */ }
  }, [earnMutation]);

  // ── Near-level notification ────────────────────────────────────────────────
  useEffect(() => {
    if (!sp) return;
    const pct  = sp.progressPct;
    const prev = prevProgressRef.current;

    if (prev !== null && pct >= 85 && prev < 85 && pct < 100 && !notifiedNearRef.current) {
      notifiedNearRef.current = true;
      toast("🚀 Quase lá!", {
        description: `Você está a ${100 - pct}% de desbloquear ${sp.nextLevel?.planetEmoji ?? ""} ${sp.nextLevel?.name ?? "o próximo nível"}!`,
        duration: 6000,
      });
    }
    if (pct < 80) notifiedNearRef.current = false;
    prevProgressRef.current = pct;
  }, [sp]);

  // ── Daily login ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (dailyLoginFired.current) return;
    dailyLoginFired.current = true;
    // Small delay to let the session settle
    const t = setTimeout(() => {
      earn("daily_login", "Login diário 🚀");
    }, 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Active time tracking (30min & 2h) ─────────────────────────────────────
  useEffect(() => {
    const THIRTY_MIN = 30 * 60 * 1000;
    const TWO_HOURS  = 2  * 60 * 60 * 1000;

    const tick = () => {
      const elapsed = Date.now() - sessionStartRef.current;

      if (!active30minFired.current && elapsed >= THIRTY_MIN) {
        active30minFired.current = true;
        earn("active_30min", "30 minutos ativo no sistema ⏱");
      }

      if (!active2hFired.current && elapsed >= TWO_HOURS) {
        active2hFired.current = true;
        earn("active_2h", "2 horas ativo no sistema 🔥");
      }
    };

    const interval = setInterval(tick, 60_000); // check every minute
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SpacePointContext.Provider value={{ earn }}>
      {children}
      <AchievementPopup data={achievement} onDismiss={() => setAchievement(null)} />
    </SpacePointContext.Provider>
  );
}

export function useSpacePointAchievement() {
  const [achievement, setAchievement] = useState<AchievementData | null>(null);
  const trigger = useCallback((data: AchievementData) => setAchievement(data), []);
  return { achievement, trigger, clear: () => setAchievement(null) };
}
