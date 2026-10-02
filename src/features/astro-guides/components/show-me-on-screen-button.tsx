"use client";

import { MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStartGuide } from "../hooks/use-start-guide";

export function ShowMeOnScreenButton({ guideKey, className }: { guideKey: string; className?: string }) {
  const startGuide = useStartGuide();
  return (
    <Button
      size="sm"
      onClick={() => startGuide(guideKey)}
      className={cn(className)}
    >
      <MousePointerClick className="size-4" />
      Me mostre na tela
    </Button>
  );
}
