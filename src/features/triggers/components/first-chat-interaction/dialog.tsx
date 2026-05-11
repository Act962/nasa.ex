import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FirstChatInteractionTriggerDialog = ({
  open,
  onOpenChange,
}: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Primeira Interação no Chat</DialogTitle>
          <DialogDescription>
            Configure o gatilho de primeira interação
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 text-center">
          <p className="text-sm text-muted-foreground">
            Esta automação será acionada apenas na primeira mensagem que o
            usuário enviar para o lead pelo chat. Mensagens seguintes para o
            mesmo lead não acionam o gatilho.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
