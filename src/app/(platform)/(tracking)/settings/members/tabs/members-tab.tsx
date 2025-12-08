"use client";

import { Button } from "@/components/ui/button";
import { useMemberModal } from "@/hooks/use-member";
import { Plus } from "lucide-react";

export function MembersTab() {
  const { onOpen } = useMemberModal();

  return (
    <div>
      <div className="w-full flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Membros</h2>
          <p className="text-sm text-foreground/50">
            Gerencie os membros da sua organização.
          </p>
        </div>

        <Button onClick={() => onOpen()}>
          <Plus className="size-4" /> Adicionar Membro
        </Button>
      </div>
    </div>
  );
}
