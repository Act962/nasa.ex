"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { SeiActionData } from "./executor";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: SeiActionData;
  onSubmit: (values: SeiActionData) => void;
};

export function SeiActionDialog({ open, onOpenChange, defaultValues, onSubmit }: Props) {
  const [protocolo, setProtocolo] = useState(defaultValues?.protocolo ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Consultar processo SEI</DialogTitle>
          <DialogDescription>
            Atualiza os dados do processo no NASA para que os próximos nós possam decidir e enviar mensagens ao lead.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="workflow-sei-protocolo">Protocolo específico (opcional)</FieldLabel>
            <Input
              id="workflow-sei-protocolo"
              value={protocolo}
              onChange={(event) => setProtocolo(event.target.value)}
              placeholder="Usar o processo mais recente vinculado ao lead"
              autoComplete="off"
            />
            <FieldDescription>
              No fluxo clássico use {"{{sei_protocolo}}"}, {"{{sei_andamento}}"} e {"{{sei_link}}"}. No Modo Agente use {"{{vars.sei.protocolo}}"}.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            type="button"
            onClick={() => {
              onSubmit({ protocolo: protocolo.trim() || undefined });
              onOpenChange(false);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
