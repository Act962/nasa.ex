import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MoveLeadStatusTriggerDialog = ({ open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover Lead para Status</DialogTitle>
          <DialogDescription>
            Configure quando o lead será movido para o status
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 text-center">
          <p className="text-sm text-muted-foreground">
            Esta automação será acionada quando um lead for movido para o status
            configurado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
