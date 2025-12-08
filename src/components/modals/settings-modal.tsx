import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTrackingSetting } from "@/hooks/use-settings";
import { ModeToggle } from "../mode-toggle";

export function SettingsModal() {
  const settings = useTrackingSetting();

  return (
    <Dialog open={settings.isOpen} onOpenChange={settings.onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Tema</span>
            <ModeToggle />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
