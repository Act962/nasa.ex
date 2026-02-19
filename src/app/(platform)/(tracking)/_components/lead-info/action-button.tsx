"use client";

import { Button } from "@/components/ui/button";

export function ActionButton({ icon }: { icon: React.ReactNode }) {
  return (
    <Button
      size="icon-xs"
      variant="secondary"
      className="rounded-full bg-secondary/50 hover:bg-secondary h-8 w-8 transition-all hover:scale-105"
    >
      {icon}
    </Button>
  );
}
