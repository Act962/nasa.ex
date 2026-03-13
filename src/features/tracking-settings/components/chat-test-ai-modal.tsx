import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChatTestAiModalProps {
  trackingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChatTestAiModal = ({
  trackingId,
  open,
  onOpenChange,
}: ChatTestAiModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:min-w-3xl md:min-w-4xl">
        <DialogHeader>
          <DialogTitle>Testar IA</DialogTitle>
          <DialogDescription>
            Teste a IA para ver como ela responde às perguntas.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
