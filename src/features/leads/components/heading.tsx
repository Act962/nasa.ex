"use client"

import { Button } from "@/components/ui/button";

import { Plus } from "lucide-react";
import Search from "./search";
import { useTracking } from "@/hooks/use-tracking-modal";

export default function Heading() {
  const { onOpen } = useTracking()

  return (
    <div className="w-full flex flex-col mt-4 gap-4">
      <div className="text-center sm:text-start">
        <h2 className="font-medium text-3xl">Tracking</h2>
        <span className="text-sm text-muted-foreground">
          Gerencie os principais processos da sua empresa e acompanhe suas
          métricas.
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Search />

        <Button onClick={onOpen}>
          <Plus />
          Novo tracking
        </Button>
      </div>
    </div>
  );
}
