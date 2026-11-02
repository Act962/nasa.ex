"use client";

import { Headphones, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Antes de a equipe conectar a conta Meta: um aviso só, sem lista de tarefas (spec 0126, RF-3). */
export function SetupInProgressCard({ onSupport }: { onSupport: () => void }) {
  return (
    <div className="rounded-[24px] border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-info/15">
          <Settings2 className="size-5 text-info" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">Nossa equipe está configurando sua conta na Meta</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Estamos conectando sua conta de anúncios à Órbita. Quando terminar, o anúncio e os números da
            campanha aparecem aqui sozinhos.
          </p>
          <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={onSupport}>
            <Headphones className="size-3.5" />
            Falar com a equipe
          </Button>
        </div>
      </div>
    </div>
  );
}
