"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useCatalogOrderMessages, useCatalogOrderPortal, useCatalogOrderStarFriends } from "../../hooks/use-catalog-order-portal";

// Avisos de etapa do pedido (spec 0044, RF-13): cada aviso novo cai do topo uma vez por navegador.

type PortalNotice = { id: string; noticeType: string; title: string; subtitle: string };

const NOTICE_VISIBLE_MS = 4500;
const NOTICE_GAP_MS = 600;

const NOTICE_ICONS: Record<string, { emoji: string; className: string }> = {
  payment_confirmed: { emoji: "✓", className: "bg-success/15 text-success" },
  star_earned: { emoji: "⭐", className: "bg-gradient-to-br from-chart-4 to-chart-2 text-white" },
  sent_to_separation: { emoji: "📦", className: "bg-info/15 text-info" },
  out_for_delivery: { emoji: "🛵", className: "bg-warning/15 text-warning" },
  ready_for_pickup: { emoji: "🛍️", className: "bg-success/15 text-success" },
};

const STAR_BURST = [
  { left: "12%", top: "30%", x: "-26px", y: "-18px", glyph: "✦" },
  { left: "18%", top: "60%", x: "28px", y: "26px", glyph: "★" },
  { left: "8%", top: "70%", x: "-18px", y: "34px", glyph: "✦" },
  { left: "24%", top: "20%", x: "22px", y: "-28px", glyph: "★" },
];

function readSeenIds(storageKey: string): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveSeenIds(storageKey: string, seenIds: Set<string>) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(seenIds).slice(-50)));
  } catch {
    // sem storage (aba anônima): o aviso pode reaparecer, sem prejuízo
  }
}

export function OrderNoticeToaster({ token }: { token: string }) {
  const messagesQuery = useCatalogOrderMessages(token);
  const { refetch: refetchOrder } = useCatalogOrderPortal(token);
  const { refetch: refetchStarFriends } = useCatalogOrderStarFriends(token);
  const [queue, setQueue] = useState<PortalNotice[]>([]);
  const [activeNotice, setActiveNotice] = useState<PortalNotice | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const storageKey = `orbita:order-notices:${token}`;

  useEffect(() => {
    const messages = messagesQuery.data?.messages;
    if (!messages) return;
    seenIdsRef.current ??= readSeenIds(storageKey);
    const seenIds = seenIdsRef.current;
    const freshNotices = messages
      .filter((message) => message.notice && !seenIds.has(message.id))
      .map((message) => ({ id: message.id, ...message.notice! }));
    if (freshNotices.length === 0) return;
    freshNotices.forEach((notice) => seenIds.add(notice.id));
    saveSeenIds(storageKey, seenIds);
    setQueue((current) => [...current, ...freshNotices]);
    // Aviso novo = etapa mudou: atualiza linha do tempo e estrelas sem esperar o próximo ciclo.
    void refetchOrder();
    void refetchStarFriends();
  }, [messagesQuery.data, storageKey, refetchOrder, refetchStarFriends]);

  useEffect(() => {
    if (activeNotice || queue.length === 0) return;
    const [nextNotice, ...rest] = queue;
    setActiveNotice(nextNotice);
    setIsLeaving(false);
    setQueue(rest);
  }, [queue, activeNotice]);

  useEffect(() => {
    if (!activeNotice) return;
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), NOTICE_VISIBLE_MS);
    const clearTimer = window.setTimeout(() => setActiveNotice(null), NOTICE_VISIBLE_MS + NOTICE_GAP_MS);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(clearTimer);
    };
  }, [activeNotice]);

  if (!activeNotice) return null;
  const icon = NOTICE_ICONS[activeNotice.noticeType] ?? NOTICE_ICONS.sent_to_separation;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3">
      <button
        type="button"
        onClick={() => setIsLeaving(true)}
        className={cn(
          "pointer-events-auto relative flex w-full max-w-md items-center gap-3 rounded-2xl border bg-card/95 p-3 text-left shadow-2xl backdrop-blur",
          isLeaving
            ? "animate-out fade-out slide-out-to-top-10 fill-mode-forwards duration-500"
            : "animate-in fade-in slide-in-from-top-10 zoom-in-95 duration-500",
        )}
      >
        {activeNotice.noticeType === "star_earned" &&
          STAR_BURST.map((particle) => (
            <span
              key={`${particle.left}-${particle.top}`}
              className="notice-star pointer-events-none absolute text-base text-info"
              style={{ left: particle.left, top: particle.top, "--burst-x": particle.x, "--burst-y": particle.y } as CSSProperties}
            >
              {particle.glyph}
            </span>
          ))}
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-xl", icon.className)}>{icon.emoji}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{activeNotice.title}</span>
          {activeNotice.subtitle && <span className="block text-xs text-muted-foreground">{activeNotice.subtitle}</span>}
        </span>
      </button>
      <style>{`
        .notice-star { opacity: 0; animation: notice-star-burst 1.6s ease-out 0.2s forwards; }
        @keyframes notice-star-burst {
          0% { opacity: 0; transform: translate(0, 0) scale(0.4); }
          25% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--burst-x), var(--burst-y)) scale(1.15); }
        }
      `}</style>
    </div>
  );
}
