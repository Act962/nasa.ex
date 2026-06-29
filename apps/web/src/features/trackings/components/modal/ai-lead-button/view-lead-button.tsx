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
      className="flex items-center gap-2 bg-zinc-900/50 border-zinc-700 hover:bg-zinc-800 hover:border-purple-500/50 text-xs my-2 transition-all group/btn w-fit"
    >
      <Eye className="size-3.5 text-purple-400 group-hover/btn:scale-110 transition-transform" />
      <span className="font-semibold text-zinc-200">Ver Lead:</span>
      <span className="text-zinc-400 truncate max-w-[150px]">{name}</span>
    </Button>
  );
}
