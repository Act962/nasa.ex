"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { toast } from "sonner";
import { useDeleteTrackingConsultant } from "../../hooks/use-tracking-consultants";

interface ModalDeleteConsultorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  consultant: {
    id: string;
    name: string;
  };
  trackingId: string;
}

export function ModalDeleteConsultor({
  isOpen,
  onOpenChange,
  consultant,
  trackingId,
}: ModalDeleteConsultorProps) {
  const [confirmName, setConfirmName] = useState("");
  const mutation = useDeleteTrackingConsultant(trackingId);
  const [isWrong, setIsWrong] = useState(false);

  const isNameValid =
    confirmName.trim().toLowerCase() === consultant.name.trim().toLowerCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isNameValid) {
      setIsWrong(true);
      return;
    }

    mutation.mutate(
      {
        id: consultant.id,
      },
      {
        onSuccess: () => {
          toast("Consultor removido com sucesso!");
          setConfirmName("");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Erro ao remover consultor.");
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Remover Consultor</DialogTitle>
          <DialogDescription>
            Essa ação não pode ser desfeita. Para confirmar, digite{" "}
            <span className="text-foreground">{consultant.name} </span>
            abaixo.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <Label htmlFor="confirm-name">Nome do consultor</Label>
            <Input
              id="confirm-name"
              name="confirmName"
              placeholder={consultant.name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
          </Field>

          {isWrong && (
            <p className="text-xs text-red-500">
              O nome digitado não corresponde.
            </p>
          )}
        </FieldGroup>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>

          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Spinner /> : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
