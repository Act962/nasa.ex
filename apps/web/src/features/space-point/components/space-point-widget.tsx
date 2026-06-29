"use client";

import { useState } from "react";
import Image from "next/image";
import { useSpacePoint } from "../hooks/use-space-point";
import { SpacePointModal } from "./space-point-modal";

export function SpacePointWidget() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useSpacePoint();

  if (isLoading) {
    return <div className="h-8 w-28 rounded-lg bg-muted/60 animate-pulse" />;
  }

  const points = data?.totalPoints ?? 0;
  const level  = data?.currentLevel;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#7a1fe7]/40 bg-[#7a1fe7]/8 hover:bg-[#7a1fe7]/15 transition-all focus-visible:outline-none group"
        title="Space Point — programa de gamificação"
      >
        <Image
          src="/space-point/icon.svg"
          alt="Space Point"
          width={18}
          height={18}
          className="shrink-0 group-hover:scale-110 transition-transform"
        />
        <span className="text-xs font-semibold tabular-nums text-[#7a1fe7]">
          {points.toLocaleString("pt-BR")}
        </span>
        {level && (
          <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">
            {level.planetEmoji}
          </span>
        )}
      </button>

      <SpacePointModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
