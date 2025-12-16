import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function Participants() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Participantes</h2>
          <p className="text-muted-foreground text-sm">
            Lista de participantes
          </p>
        </div>
        <Button>
          <Plus />
          Adicionar
        </Button>
      </div>

      <div></div>
    </div>
  );
}
