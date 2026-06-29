"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, TrendingUp, Clock, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useUserStats, type RankingPeriod } from "../hooks/use-space-point";

// ── Action → icon map ─────────────────────────────────────────────────────────
const ACTION_ICONS: Record<string, string> = {
  lead_won:              "🏆",
  create_event:          "📅",
  create_agenda:         "🗓",
  create_workspace_card: "📋",
  workspace_cards_10day: "🔥",
  first_lead:            "🎯",
  close_tracking:        "✅",
  send_form:             "📝",
  manual:                "✨",
};

const BAR_COLORS = [
  "#7a1fe7", "#a855f7", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#8b5cf6",
];

// ── Custom tooltip for bar chart ──────────────────────────────────────────────
function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; points: number; count: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#1a0a3d] border border-[#7a1fe7]/40 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{d.label}</p>
      <p className="text-[#a78bfa]">{d.points} pts</p>
      <p className="text-muted-foreground">{d.count} ações</p>
    </div>
  );
}

// ── Mini seal badge ───────────────────────────────────────────────────────────
function SealBadge({ badgeNumber, name, earnedAt }: { badgeNumber: number; name: string; earnedAt: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-12 h-12">
        <Image
          src={`/space-point/badges/${badgeNumber}.svg`}
          alt={name}
          fill
          className="object-contain drop-shadow-[0_0_8px_rgba(122,31,231,0.6)]"
        />
      </div>
      <p className="text-[9px] text-muted-foreground text-center leading-tight">{name}</p>
    </div>
  );
}

// ── History row ───────────────────────────────────────────────────────────────
function HistoryRow({ item }: {
  item: { points: number; description: string; action: string | null; createdAt: string };
}) {
  const icon = ACTION_ICONS[item.action ?? "manual"] ?? "✨";
  const date = new Date(item.createdAt);
  const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="w-8 h-8 rounded-xl bg-[#7a1fe7]/15 flex items-center justify-center text-base shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{item.description}</p>
        <p className="text-[10px] text-muted-foreground">{dateStr} · {timeStr}</p>
      </div>
      <span className="text-xs font-bold text-[#a78bfa] shrink-0">+{item.points}</span>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────
interface UserStatsDrawerProps {
  userId: string | null;
  userName: string;
  userImage: string | null;
  period: RankingPeriod;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
}

type LocalTab = "apps" | "history" | "seals";

export function UserStatsDrawer({
  userId, userName, userImage, period, startDate, endDate, onClose,
}: UserStatsDrawerProps) {
  const [tab, setTab] = useState<LocalTab>("apps");
  const { data, isLoading } = useUserStats(userId, period, startDate, endDate);

  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const chartData = (data?.appBreakdown ?? []).map((d) => ({
    label:  d.label.length > 20 ? d.label.slice(0, 18) + "…" : d.label,
    fullLabel: d.label,
    points: d.points,
    count:  d.count,
    icon:   ACTION_ICONS[d.action] ?? "✨",
  }));

  const drawerContent = (
    <div
      className="fixed inset-0 flex items-center justify-end"
      style={{ zIndex: 10001 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative h-full w-full max-w-sm flex flex-col bg-[#0d0d1a] border-l border-[#7a1fe7]/25 shadow-2xl overflow-hidden"
        style={{ animation: "slideInRight 0.3s ease-out" }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[#7a1fe7]/15 bg-gradient-to-r from-[#7a1fe7]/10 to-transparent shrink-0">
          <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#7a1fe7]/50 shrink-0">
            {userImage ? (
              <Image src={userImage} alt={userName} fill className="object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#7a1fe7] to-[#4c1d95] flex items-center justify-center text-white text-sm font-bold">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{userName}</p>
            {data && (
              <p className="text-[11px] text-[#a78bfa]">
                <span className="font-semibold tabular-nums">{data.totalInPeriod.toLocaleString("pt-BR")}</span> pts neste período
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all"
          >
            <X className="size-4 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pt-3 shrink-0">
          {([
            { key: "apps",    label: "Apps",     icon: <TrendingUp className="size-3" /> },
            { key: "history", label: "Histórico", icon: <Clock className="size-3" /> },
            { key: "seals",   label: "Selos",     icon: <Award className="size-3" /> },
          ] as { key: LocalTab; label: string; icon: React.ReactNode }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all",
                tab === t.key
                  ? "bg-[#7a1fe7] text-white"
                  : "text-muted-foreground hover:bg-white/5",
              )}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* ── Apps tab ── */}
              {tab === "apps" && (
                <div className="flex flex-col gap-4">
                  {chartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma atividade neste período.
                    </p>
                  ) : (
                    <>
                      {/* Bar chart */}
                      <div className="bg-white/3 rounded-2xl p-3 border border-white/5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                          Pontos por ação
                        </p>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis
                              type="category"
                              dataKey="icon"
                              width={24}
                              tick={{ fontSize: 14, fill: "white" }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(122,31,231,0.08)" }} />
                            <Bar dataKey="points" radius={[0, 6, 6, 0]} barSize={16}>
                              {chartData.map((_, idx) => (
                                <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Detail rows */}
                      <div className="space-y-2">
                        {data?.appBreakdown.map((item, idx) => {
                          const maxPts = data.appBreakdown[0]?.points ?? 1;
                          const pct = Math.round((item.points / maxPts) * 100);
                          return (
                            <div key={item.action} className="bg-white/3 rounded-xl px-3 py-2.5 border border-white/5">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-base">{ACTION_ICONS[item.action] ?? "✨"}</span>
                                <span className="text-xs font-medium text-foreground flex-1 truncate">{item.label}</span>
                                <span className="text-xs font-bold tabular-nums" style={{ color: BAR_COLORS[idx % BAR_COLORS.length] }}>
                                  {item.points} pts
                                </span>
                              </div>
                              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, background: BAR_COLORS[idx % BAR_COLORS.length] }}
                                />
                              </div>
                              <p className="text-[9px] text-muted-foreground mt-1">{item.count} ações realizadas</p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── History tab ── */}
              {tab === "history" && (
                <div>
                  {data?.history.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma transação neste período.
                    </p>
                  ) : (
                    <div className="pb-4">
                      {data?.history.map((item, i) => (
                        <HistoryRow key={i} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Seals tab ── */}
              {tab === "seals" && (
                <div>
                  {!data?.seals.length ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum selo conquistado ainda.
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 gap-3 pb-4">
                      {data.seals.map((s, i) => (
                        <SealBadge key={i} badgeNumber={s.badgeNumber} name={s.name} earnedAt={s.earnedAt} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
