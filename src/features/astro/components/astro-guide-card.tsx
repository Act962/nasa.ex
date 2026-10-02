"use client";

import { Compass } from "lucide-react";
import { ShowMeOnScreenButton } from "@/features/astro-guides/components/show-me-on-screen-button";
import type { AstroGuidePayload } from "@/features/astro/lib/astro-guide";

export function AstroGuideCard({ payload }: { payload: AstroGuidePayload }) {
  return (
    <div className="rounded-[20px] bg-card p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info/15 text-info">
          <Compass className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{payload.title}</p>
          <p className="text-xs text-muted-foreground">{payload.summary}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {payload.stepCount} {payload.stepCount === 1 ? "passo" : "passos"} na sua tela, com seta e explicação
          </p>
        </div>
      </div>
      <ShowMeOnScreenButton guideKey={payload.guideKey} className="mt-3 w-full" />
    </div>
  );
}
