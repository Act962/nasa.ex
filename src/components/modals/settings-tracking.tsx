import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTrackingSetting } from "@/hooks/use-settings";
import { authClient } from "@/lib/auth-client";
import { ModeToggle } from "../mode-toggle";

export function ModalSettingTracking() {
  const settings = useTrackingSetting();
  const { data: session, isPending } = authClient.useSession();

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
