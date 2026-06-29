"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useEffect,
} from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { pusherClient } from "@/lib/pusher";
import { authClient } from "@/lib/auth-client";
import { AchievementPopup, type AchievementData } from "./achievement-popup";
import { useEarnSpacePoints, useSpacePoint } from "../hooks/use-space-point";
import {
  useSpacePointStore,
  type PopupTemplateData,
} from "../store/use-space-point-store";
import { DEFAULT_RULES } from "@/app/router/space-point/defaults";

// PopupTemplateData moved to ../store/use-space-point-store.ts

interface SpacePointCtx {
  earn: (
    action: string,
    description?: string,
    metadata?: Record<string, unknown>,
  ) => Promise<void>;
}
const SpacePointContext = createContext<SpacePointCtx>({
  earn: async () => {},
});
export const useSpacePointCtx = () => useContext(SpacePointContext);

export function SpacePointProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { achievement, setAchievement, popupTemplates, setPopupTemplates } =
    useSpacePointStore();
  const { mutateAsync: earnMutation } = useEarnSpacePoints();
  const { data: sp } = useSpacePoint();
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    fetch("/api/popup-templates")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setPopupTemplates(data))
      .catch(() => {});
  }, [setPopupTemplates]);

  // ── Pusher listener: real-time points updates ────────────────────────────
  useEffect(() => {
    const userId = session?.user?.id;
    console.log("Passou");
    if (!userId) return;

    const channel = pusherClient.subscribe(`private-user-${userId}`);
    channel.bind(
      "points:updated",
      (data: {
        spAwarded: number;
        starsDebited: number;
        totalSP: number;
        popupTemplateId: string | null;
        newSeals: {
          name: string;
          badgeNumber: number;
          planetEmoji: string;
          badgeUrl: string;
        }[];
        action: string;
      }) => {
        // Invalidar cache TanStack Query
        queryClient.invalidateQueries({ queryKey: ["spacePoint"] });

        const isPenalty = data.spAwarded < 0;

        // Popup template especifico
        if (data.popupTemplateId && popupTemplates.length > 0) {
          const tpl = popupTemplates.find((t) => t.id === data.popupTemplateId);
          if (tpl) {
            setAchievement({
              type: "achievement",
              title: isPenalty
                ? "Penalidade aplicada"
                : `+${data.spAwarded} pts`,
              message: isPenalty
                ? `${Math.abs(data.spAwarded)} SPs debitados.`
                : `+${data.spAwarded} Space Points conquistados!`,
              template: tpl as AchievementData["template"],
              vars: {
                nova_conquista: DEFAULT_RULES.find((r) => r.action === data.action)?.label ?? data.action,
                quantidade_space_points: String(data.totalSP),
                quantidade_stars: String(data.starsDebited),
                nome_plano: sp?.currentLevel?.name ?? "",
                meu_ranking: "",
              },
            });
            return;
          }
        }

        // New seals
        if (data.newSeals.length > 0) {
          const seal = data.newSeals[data.newSeals.length - 1]!;
          setAchievement({
            type: "level_up",
            title: `Voce chegou a ${seal.name}!`,
            message: `Parabens! Voce desbloqueou ${seal.planetEmoji} ${seal.name}.`,
            badgeNumber: seal.badgeNumber,
            badgeUrl: seal.badgeUrl,
            planetEmoji: seal.planetEmoji,
          });
        } else if (data.spAwarded !== 0) {
          if (isPenalty) {
            toast.error(`${data.spAwarded} pts`, { duration: 3500 });
          } else {
            toast(`+${data.spAwarded} pts`, { duration: 2500 });
          }
        }

        if (data.starsDebited > 0) {
          toast(`-${data.starsDebited} Stars`, { duration: 2000 });
        }
      },
    );

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(`private-user-${userId}`);
    };
  }, [session?.user?.id, popupTemplates, queryClient, sp]);

  const getTemplate = (type: string): PopupTemplateData | undefined =>
    popupTemplates.find((t) => t.type === type) ?? popupTemplates[0];
  const prevProgressRef = useRef<number | null>(null);
  const notifiedNearRef = useRef(false);
  const dailyLoginFired = useRef(false);
  const active30minFired = useRef(false);
  const active2hFired = useRef(false);
  const sessionStartRef = useRef<number>(Date.now());

  // ── Earn helper ────────────────────────────────────────────────────────────
  const earn = useCallback(
    async (
      action: string,
      description?: string,
      metadata?: Record<string, unknown>,
    ) => {
      try {
        const result = await earnMutation({ action, description, metadata });
        if (!result.awarded) return;

        const isPenalty = result.awarded < 0;

        // Show rule-specific popup template if configured
        if (result.popupTemplateId) {
          const tpl =
            popupTemplates.find((t) => t.id === result.popupTemplateId) ??
            getTemplate(isPenalty ? "penalty" : "achievement");
          setAchievement({
            type: isPenalty ? "achievement" : "achievement",
            title: isPenalty
              ? "Penalidade aplicada"
              : (description ?? `+${result.awarded} pts ✨`),
            message: isPenalty
              ? `${Math.abs(result.awarded)} SPs debitados.`
              : `+${result.awarded} Space Points conquistados!`,
            template: tpl as AchievementData["template"],
            vars: {
              nova_conquista: description ?? action,
              quantidade_space_points: String(result.totalPoints),
              quantidade_stars: String(Math.abs(result.awarded)),
              nome_plano: sp?.currentLevel?.name ?? "",
              meu_ranking: "",
            },
          });
          return;
        }

        if (result.newSeals.length > 0) {
          const seal = result.newSeals[result.newSeals.length - 1];
          const tpl = getTemplate("level_up");
          setAchievement({
            type: "level_up",
            title: `Você chegou a ${seal.name}!`,
            message: `Parabéns! Você desbloqueou ${seal.planetEmoji} ${seal.name}. Continue explorando o NASA!`,
            badgeNumber: seal.badgeNumber,
            badgeUrl: seal.badgeUrl,
            planetEmoji: seal.planetEmoji,
            template: tpl as AchievementData["template"],
            vars: {
              nova_conquista: seal.name,
              quantidade_stars: String(result.awarded ?? 0),
              quantidade_space_points: String(sp?.totalPoints ?? 0),
              nome_plano: sp?.currentLevel?.name ?? "",
              meu_ranking: "",
            },
          });
        } else if (isPenalty) {
          toast.error(`${result.awarded} pts ⚠️`, {
            description: description,
            duration: 3500,
          });
        } else {
          toast(`+${result.awarded} pts ✨`, { duration: 2500 });
        }
      } catch {
        /* silently fail */
      }
    },
    [earnMutation, popupTemplates, sp],
  );

  // ── Near-level notification ────────────────────────────────────────────────
  useEffect(() => {
    if (!sp) return;
    const pct = sp.progressPct;
    const prev = prevProgressRef.current;

    if (
      prev !== null &&
      pct >= 85 &&
      prev < 85 &&
      pct < 100 &&
      !notifiedNearRef.current
    ) {
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
    const TWO_HOURS = 2 * 60 * 60 * 1000;

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
      <AchievementPopup
        data={achievement}
        onDismiss={() => setAchievement(null)}
      />
    </SpacePointContext.Provider>
  );
}

export function useSpacePointAchievement() {
  const { achievement, setAchievement } = useSpacePointStore();
  const trigger = useCallback(
    (data: AchievementData) => setAchievement(data),
    [setAchievement],
  );
  return { achievement, trigger, clear: () => setAchievement(null) };
}
