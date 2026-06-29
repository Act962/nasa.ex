"use client";

import { SpaceCard } from "../space-card";
import { Button } from "@/components/ui/button";
import { Star, Sparkles } from "lucide-react";

interface CardStarsProps {
  starsReceived: number;
}

export function CardStars({ starsReceived }: CardStarsProps) {
  return (
    <SpaceCard
      title="STARs recebidas"
      subtitle="Reconhecimento da comunidade"
    >
      <div className="flex flex-col items-center gap-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-orange-500">
          <Star className="size-8 fill-white text-white" />
        </div>
        <div>
          <p className="text-3xl font-bold text-white">
            {starsReceived.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-white/60">STARs recebidas</p>
        </div>
        <Button className="bg-yellow-500 text-slate-950 hover:bg-yellow-400">
          <Sparkles className="mr-1 size-4" />
          Enviar STAR
        </Button>
      </div>
    </SpaceCard>
  );
}
