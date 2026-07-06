"use client";

const TIMER_PRESETS = [15, 30, 60, 180, 300, 600];

function formatPreset(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${seconds / 60}m`;
}

export function SalesGoalSideRail({
  accent,
  autoAdvanceSeconds,
  onChangeAutoAdvance,
}: {
  accent: string;
  autoAdvanceSeconds: number;
  onChangeAutoAdvance: (seconds: number) => void;
}) {
  return (
    <div className="hidden lg:flex flex-col items-center gap-1 w-12 shrink-0">
      {TIMER_PRESETS.map((seconds) => (
        <button
          key={seconds}
          onClick={() => onChangeAutoAdvance(seconds)}
          className="text-[10px] px-1.5 py-1 rounded-md font-semibold w-9"
          style={
            autoAdvanceSeconds === seconds
              ? { background: accent, color: "#fff" }
              : { background: "rgba(255,255,255,0.05)" }
          }
        >
          {formatPreset(seconds)}
        </button>
      ))}
    </div>
  );
}
