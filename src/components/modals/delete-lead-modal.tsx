"use client";

import { useDeletLead } from "@/hooks/use-delete-lead";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";

export function DeletarLeadModal() {
  const queryClient = useQueryClient();
  const { lead, onClose, isOpen } = useDeletLead();
  const leadName = lead?.name.split(" ").slice(0, 2).join(" ");
  const [leadConfimed, setLeadConfirmed] = useState("");

  const mutation = useMutation(
    orpc.leads.archive.mutationOptions({
      onSuccess: ({ lead }) => {
        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId: lead.trackingId,
            },
          }),
        });
        toast.success("Lead deletado!");
        onClose();
      },
      onError: () => {
        toast.error("Erro ao deletar lead!");
      },
    })
  );

  function onDelete() {
    if (!lead?.id) return;

    mutation.mutate({
      leadId: lead.id,
    });
  }
  useEffect(() => {
    if (!isOpen) {
      setLeadConfirmed("");
    }
  }, [isOpen]);

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deletar lead</DialogTitle>
          <DialogDescription>
            Deseja realmente deletar o lead <strong>{leadName}</strong>? Essa
            ação não pode ser desfeita
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="nameLead">
            Confirme digitando a palavra "Confirmar"
          </Label>
          <Input
            onChange={(e) => setLeadConfirmed(e.target.value)}
            id={"nameLead"}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant={"outline"}>Cancelar</Button>
          </DialogClose>
          <Button
            onClick={onDelete}
            variant={"destructive"}
            disabled={!(leadConfimed == "Confirmar")}
          >
            Deletar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
