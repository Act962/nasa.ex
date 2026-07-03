"use client";
import { useConstructUrl } from "@/hooks/use-construct-url";

type ProgressMascotIconProps = {
  mascot: { emoji?: string; imageUrl?: string; label: string };
  progressPct: number;
};

export function ProgressMascotIcon({ mascot, progressPct }: ProgressMascotIconProps) {
  const imageSrc = useConstructUrl(mascot.imageUrl || "");
  return (
    <span
      aria-hidden="true"
      title={`${mascot.label} (${progressPct}%)`}
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 leading-none select-none transition-[left] duration-500 ease-out drop-shadow-sm flex items-center justify-center"
      style={{
        left: `${progressPct}%`,
        filter:
          progressPct === 100
            ? "drop-shadow(0 0 6px rgba(250,204,21,0.6))"
            : undefined,
      }}
    >
      {mascot.imageUrl ? (
        <img
          src={imageSrc}
          alt={mascot.label}
          className="w-6 h-6 object-contain rounded"
          draggable={false}
        />
      ) : (
        <span className="text-base">{mascot.emoji || "•"}</span>
      )}
    </span>
  );
}
