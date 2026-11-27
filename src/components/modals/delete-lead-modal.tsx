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
import { client, orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { ConfirmationPhrase } from "../confirmation-phrase";

function toShortName(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).join(" ");
}

export function DeletarLeadModal() {
  const queryClient = useQueryClient();
  const { leads, onClose, onDone, isOpen } = useDeletLead();
  const [typedConfirmation, setTypedConfirmation] = useState("");

  const isSingleLead = leads.length === 1;
  const leadName = isSingleLead ? toShortName(leads[0].name) : "";
  const confirmationPhrase = isSingleLead
    ? `Deletar ${leadName}`
    : `Deletar ${leads.length} leads`;
  const isConfirmed = typedConfirmation.trim() === confirmationPhrase;

  const mutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const results = await Promise.allSettled(
        leadIds.map((leadId) => client.leads.archive({ leadId })),
      );
      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;
      return { failedCount, total: leadIds.length };
    },
    onSuccess: ({ failedCount, total }) => {
      // A coluna do board usa uma queryKey manual; o prefixo cobre todas.
      queryClient.invalidateQueries({ queryKey: ["leads.listLeadsByStatus"] });
      queryClient.invalidateQueries({ queryKey: orpc.status.getMany.key() });

      if (failedCount === total) {
        toast.error("Erro ao deletar lead!");
        return;
      }
      if (failedCount > 0) {
        toast.warning(`${total - failedCount} de ${total} leads deletados.`);
      } else {
        toast.success(isSingleLead ? "Lead deletado!" : "Leads deletados!");
      }
      onDone?.();
      onClose();
    },
    onError: () => {
      toast.error("Erro ao deletar lead!");
    },
  });

  function onDelete() {
    if (leads.length === 0 || !isConfirmed) return;
    mutation.mutate(leads.map((lead) => lead.id));
  }

  useEffect(() => {
    if (!isOpen) {
      setTypedConfirmation("");
    }
  }, [isOpen]);

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isSingleLead ? "Deletar lead" : "Deletar leads"}
          </DialogTitle>
          <DialogDescription>
            {isSingleLead ? (
              <>
                Deseja realmente deletar o lead <strong>{leadName}</strong>?
              </>
            ) : (
              <>
                Deseja realmente deletar os <strong>{leads.length}</strong>{" "}
                leads selecionados?
              </>
            )}{" "}
            Eles vão para os Deletados.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            onDelete();
          }}
        >
          <Label htmlFor="deleteLeadConfirmation" className="flex-wrap">
            Para confirmar, digite
            <ConfirmationPhrase phrase={confirmationPhrase} />
          </Label>
          <Input
            value={typedConfirmation}
            onChange={(event) => setTypedConfirmation(event.target.value)}
            id="deleteLeadConfirmation"
            placeholder="Digite ou cole o texto acima"
            autoComplete="off"
          />
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={onDelete}
            variant="destructive"
            disabled={!isConfirmed || mutation.isPending}
          >
            {mutation.isPending ? "Deletando..." : "Deletar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
