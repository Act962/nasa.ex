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
      <div className="flex flex-col items-center gap-4 rounded-xl border border-warning/30 bg-warning/10 p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-warning">
          <Star className="size-8 fill-primary-foreground text-primary-foreground" />
        </div>
        <div>
          <p className="text-3xl font-bold text-foreground">
            {starsReceived.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-muted-foreground">STARs recebidas</p>
        </div>
        <Button className="bg-warning text-primary-foreground hover:bg-warning/90">
          <Sparkles className="mr-1 size-4" />
          Enviar STAR
        </Button>
      </div>
    </SpaceCard>
  );
}
