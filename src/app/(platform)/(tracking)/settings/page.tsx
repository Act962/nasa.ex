import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";

export default function Page() {
  return (
    <div className="px-4">
      <div className="flex items-center justify-between py-6">
        <div>
          <h2 className="font-medium">Tema</h2>
          <span className="text-xs text-muted-foreground">
            Mude o tema para o modo escuro
          </span>
        </div>
        <ModeToggle />
      </div>
      <Separator />
    </div>
  );
}
