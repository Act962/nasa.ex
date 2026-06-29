"use client";

import { useState } from "react";
import Image from "next/image";
import { BarChart2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSpacePointRanking,
  type RankingPeriod,
} from "../../hooks/use-space-point";
import { UserStatsDrawer } from "../user-stats-drawer";

// ── Period config ─────────────────────────────────────────────────────────────
const PERIODS: { key: RankingPeriod; label: string }[] = [
  { key: "weekly", label: "Semanal" },
  { key: "biweekly", label: "Quinzenal" },
  { key: "monthly", label: "Mensal" },
  { key: "annual", label: "Anual" },
  { key: "alltime", label: "Histórico" },
  { key: "custom", label: "📅 Data" },
];

// ── Floating Astronaut Helmet ─────────────────────────────────────────────────
function AstronautHelmet({
  src,
  name,
  size = 160,
  rank,
  floatDelay = 0,
}: {
  src?: string | null;
  name: string;
  size?: number;
  rank: number;
  floatDelay?: number;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const avatarLeft = "25%";
  const avatarTop = "21%";
  const avatarWidth = "52%";
  const avatarHeight = "46%";
  const glowColors = ["#ffd700", "#c0c0c0", "#cd7f32"];
  const glow = glowColors[rank - 1] ?? "#7a1fe7";

  return (
    <div
      className="relative shrink-0"
      style={{
        width: size,
        height: size,
        animation: `helmetFloat 4s ease-in-out infinite`,
        animationDelay: `${floatDelay}s`,
        filter: `drop-shadow(0 0 ${rank === 1 ? 24 : 14}px ${glow}88)`,
      }}
    >
      <div
        className="absolute overflow-hidden rounded-full"
        style={{
          left: avatarLeft,
          top: avatarTop,
          width: avatarWidth,
          height: avatarHeight,
        }}
      >
        {src ? (
          <Image src={src} alt={name} fill className="object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white font-bold"
            style={{
              background:
                "radial-gradient(circle at 35% 35%, #7a1fe7, #1a0a3d)",
              fontSize: size * 0.13,
            }}
          >
            {initials}
          </div>
        )}
      </div>
      <Image
        src="/space-point/helmet.png"
        alt="Capacete"
        fill
        className="object-contain relative z-10"
        style={{ pointerEvents: "none" }}
      />
    </div>
  );
}

function RankCrown({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl drop-shadow-[0_0_8px_#ffd700]">
        👑
      </div>
    );
  if (rank === 2)
    return (
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl">
        🥈
      </div>
    );
  return (
    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl">🥉</div>
  );
}

interface RankEntry {
  userId: string;
  name: string;
  image: string | null;
  points: number;
  rank: number;
  levelName: string | null;
  badgeNumber: number | null;
  badgeUrl: string | null;
}

// ── Podium card ───────────────────────────────────────────────────────────────
function PodiumCard({
  entry,
  rank,
  floatDelay,
  isFirst,
  onStats,
  period,
  startDate,
  endDate,
}: {
  entry: RankEntry;
  rank: number;
  floatDelay: number;
  isFirst?: boolean;
  onStats: (e: RankEntry) => void;
  period: RankingPeriod;
  startDate?: string;
  endDate?: string;
}) {
  const accent = {
    1: {
      border: "#ffd700",
      bg: "rgba(255,215,0,0.12)",
      text: "#ffd700",
      pts: "#ffe57f",
    },
    2: {
      border: "#c0c0c0",
      bg: "rgba(192,192,192,0.10)",
      text: "#e0e0e0",
      pts: "#f5f5f5",
    },
    3: {
      border: "#cd7f32",
      bg: "rgba(205,127,50,0.12)",
      text: "#e8a060",
      pts: "#f5c08a",
    },
  }[rank] ?? {
    border: "#7a1fe7",
    bg: "rgba(122,31,231,0.10)",
    text: "#a78bfa",
    pts: "#c4b5fd",
  };

  const helmetSize = isFirst ? 155 : 120;

  return (
    <div
      className="relative flex flex-col items-center gap-1.5 pt-6 pb-2 px-2"
      style={{ minWidth: isFirst ? 130 : 100 }}
    >
      <RankCrown rank={rank} />
      <AstronautHelmet
        src={entry.image}
        name={entry.name}
        size={helmetSize}
        rank={rank}
        floatDelay={floatDelay}
      />
      <p
        className="text-xs font-bold text-center truncate max-w-full mt-0.5"
        style={{ color: accent.text }}
      >
        {entry.name}
      </p>
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums"
        style={{
          background: accent.border + "22",
          color: accent.pts,
          border: `1px solid ${accent.border}44`,
        }}
      >
        ✦ {entry.points.toLocaleString("pt-BR")} pts
      </div>
      {entry.badgeNumber && (
        <div className="relative w-5 h-5">
          <Image
            src={
              entry.badgeUrl ?? `/space-point/badges/${entry.badgeNumber}.svg`
            }
            alt=""
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      )}
      <button
        onClick={() => onStats(entry)}
        className="mt-0.5 flex items-center gap-1 text-[10px] text-[#a78bfa] hover:text-white bg-[#7a1fe7]/20 hover:bg-[#7a1fe7]/40 px-2 py-0.5 rounded-lg transition-all"
      >
        <BarChart2 className="size-3" /> Ver stats
      </button>
    </div>
  );
}

// ── Regular rank row ──────────────────────────────────────────────────────────
function RankRow({
  entry,
  isMe,
  onStats,
}: {
  entry: RankEntry;
  isMe?: boolean;
  onStats: (e: RankEntry) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all border",
        isMe
          ? "bg-[#7a1fe7]/20 border-[#7a1fe7]/40"
          : "hover:bg-white/5 border-transparent",
      )}
    >
      <div className="w-6 text-center shrink-0">
        <span className="text-xs font-bold text-muted-foreground">
          {entry.rank}
        </span>
      </div>
      <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-[#7a1fe7]/30">
        {entry.image ? (
          <Image
            src={entry.image}
            alt={entry.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-[#7a1fe7] to-[#4c1d95] flex items-center justify-center text-white text-[10px] font-bold">
            {entry.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-semibold truncate",
            isMe && "text-[#a78bfa]",
          )}
        >
          {entry.name}
          {isMe && (
            <span className="ml-1 text-[9px] text-[#7a1fe7] bg-[#7a1fe7]/15 px-1.5 py-0.5 rounded-full font-bold">
              VOCÊ
            </span>
          )}
        </p>
        {entry.levelName && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            {entry.badgeNumber && (
              <span className="relative inline-block w-3 h-3 shrink-0">
                <Image
                  src={
                    entry.badgeUrl ??
                    `/space-point/badges/${entry.badgeNumber}.svg`
                  }
                  alt=""
                  fill
                  className="object-contain"
                  unoptimized
                />
              </span>
            )}
            {entry.levelName}
          </p>
        )}
      </div>
      <span className="text-xs font-bold tabular-nums text-[#a78bfa] shrink-0">
        {entry.points.toLocaleString("pt-BR")} pts
      </span>
      <button
        onClick={() => onStats(entry)}
        className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg bg-[#7a1fe7]/15 hover:bg-[#7a1fe7]/35 transition-all text-[#a78bfa]"
        title="Ver estatísticas"
      >
        <BarChart2 className="size-3.5" />
      </button>
    </div>
  );
}

// ── Date range picker row ─────────────────────────────────────────────────────
function DateRangePicker({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (s: string, e: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CalendarDays className="size-3.5 text-muted-foreground shrink-0" />
      <div className="flex items-center gap-1.5 flex-wrap">
        <input
          type="date"
          value={start}
          onChange={(e) => onChange(e.target.value, end)}
          className="text-xs bg-white/5 border border-[#7a1fe7]/30 rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[#7a1fe7] scheme-dark"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <input
          type="date"
          value={end}
          onChange={(e) => onChange(start, e.target.value)}
          className="text-xs bg-white/5 border border-[#7a1fe7]/30 rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[#7a1fe7] scheme-dark"
        />
      </div>
    </div>
  );
}

// ── Main ranking tab ──────────────────────────────────────────────────────────
export function RankingTab({ myUserId }: { myUserId?: string }) {
  const [period, setPeriod] = useState<RankingPeriod>("weekly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [statsEntry, setStatsEntry] = useState<RankEntry | null>(null);

  const { data, isLoading } = useSpacePointRanking(
    period,
    period === "custom" ? startDate : undefined,
    period === "custom" ? endDate : undefined,
  );

  const top3 = data?.slice(0, 3) ?? [];
  const rest = data?.slice(3) ?? [];
  const podium =
    top3.length >= 2 ? [top3[1], top3[0], top3[2]].filter(Boolean) : top3;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <style>{`
        @keyframes helmetFloat {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50%       { transform: translateY(-10px) rotate(1deg); }
        }
        @keyframes starPulse {
          0%, 100% { opacity: 0.3; } 50% { opacity: 0.9; }
        }
      `}</style>

      {/* ── Period selector ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "py-1.5 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                period === p.key
                  ? "bg-[#7a1fe7] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date picker */}
        {period === "custom" && (
          <DateRangePicker
            start={startDate}
            end={endDate}
            onChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-4 justify-center py-8">
          {[130, 160, 130].map((h, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white/5 animate-pulse"
              style={{ width: h, height: h + 100 }}
            />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="flex gap-5">
          {/* ── Left: Podium ── */}
          <div className="shrink-0" style={{ width: "48%" }}>
            <div className="relative rounded-2xl overflow-hidden bg-linear-to-b from-[#0d0030] to-[#050510] border border-[#7a1fe7]/20 px-2 pt-4 pb-3 min-h-[300px] flex flex-col justify-end">
              {/* Stars */}
              {Array.from({ length: 28 }, (_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white"
                  style={{
                    width: i % 5 === 0 ? 2 : 1,
                    height: i % 5 === 0 ? 2 : 1,
                    left: `${(((i * 1234567 + 89) % 9973) / 9973) * 100}%`,
                    top: `${(((i * 7654321 + 31) % 9973) / 9973) * 100}%`,
                    opacity: 0.12 + (i % 7) * 0.07,
                    animation: `starPulse ${2 + (i % 3)}s ease-in-out infinite`,
                    animationDelay: `${(i % 10) * 0.35}s`,
                  }}
                />
              ))}
              <div className="relative z-10 flex items-end justify-center gap-1 w-full">
                {podium.map((entry, idx) => (
                  <PodiumCard
                    key={entry.userId}
                    entry={entry}
                    rank={entry.rank}
                    floatDelay={idx * 0.6}
                    isFirst={entry.rank === 1}
                    onStats={setStatsEntry}
                    period={period}
                    startDate={startDate}
                    endDate={endDate}
                  />
                ))}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              {period === "weekly" && "Últimos 7 dias"}
              {period === "biweekly" && "Últimos 15 dias"}
              {period === "monthly" && "Últimos 30 dias"}
              {period === "annual" && "Último ano"}
              {period === "alltime" && "Pontuação total histórica"}
              {period === "custom" &&
                startDate &&
                endDate &&
                `${startDate} → ${endDate}`}
            </p>
          </div>

          {/* ── Right: list 4+ ── */}
          <div className="flex-1 flex flex-col overflow-y-auto max-h-[420px]">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 shrink-0">
              Classificação
            </p>
            <div className="flex flex-col gap-1">
              {/* Also show positions 1-3 in list for context */}
              {top3.map((entry) => (
                <RankRow
                  key={entry.userId}
                  entry={entry}
                  isMe={entry.userId === myUserId}
                  onStats={setStatsEntry}
                />
              ))}
              {rest.length > 0 && (
                <div className="border-t border-white/5 my-1" />
              )}
              {rest.map((entry) => (
                <RankRow
                  key={entry.userId}
                  entry={entry}
                  isMe={entry.userId === myUserId}
                  onStats={setStatsEntry}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-14 text-muted-foreground">
          <p className="text-4xl mb-3">🚀</p>
          <p className="text-sm font-semibold">Nenhum explorador ainda</p>
          <p className="text-xs mt-1 opacity-60">
            Realize ações para aparecer no ranking!
          </p>
        </div>
      )}

      {/* User stats drawer */}
      {statsEntry && (
        <UserStatsDrawer
          userId={statsEntry.userId}
          userName={statsEntry.name}
          userImage={statsEntry.image}
          period={period}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setStatsEntry(null)}
        />
      )}
    </div>
  );
}
