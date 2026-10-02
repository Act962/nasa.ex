"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ViewLeadButtonProps } from "./types";

export function ViewLeadButton({ name, id }: ViewLeadButtonProps) {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push(`/contatos/${id}`)}
      className="flex items-center gap-2 bg-card/50 border-line hover:bg-card hover:border-info/50 text-xs my-2 transition-all group/btn w-fit"
    >
      <Eye className="size-3.5 text-info group-hover/btn:scale-110 transition-transform" />
      <span className="font-semibold text-foreground">Ver Lead:</span>
      <span className="text-muted-foreground truncate max-w-[150px]">{name}</span>
    </Button>
  );
}
