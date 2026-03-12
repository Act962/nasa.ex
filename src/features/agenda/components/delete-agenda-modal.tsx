import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteAgendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (agendaId: string) => void;
  agendaId: string;
}

export function DeleteAgendaModal({
  open,
  onOpenChange,
  onDelete,
  agendaId,
}: DeleteAgendaModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir agenda</DialogTitle>
          <DialogDescription>
            Você tem certeza que deseja excluir esta agenda?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => onDelete(agendaId)}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
