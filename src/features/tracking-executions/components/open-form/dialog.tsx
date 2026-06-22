"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ResourceSelect } from "../send-app-actions/resource-select";
import { orpc } from "@/lib/orpc";
import type { OpenFormData } from "./executor";

/**
 * Dialog OPEN_FORM — não tem mensagem (nada é enviado pro lead via
 * WhatsApp). Só seleção do formulário a abrir pro operador preencher.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: OpenFormData;
  onSubmit: (values: OpenFormData) => void;
}

export function OpenFormDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: Props) {
  const [formId, setFormId] = useState(defaultValues?.formId ?? "");

  useEffect(() => {
    if (open) {
      setFormId(defaultValues?.formId ?? "");
    }
  }, [open, defaultValues]);

  const canSubmit = formId.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir Formulário</DialogTitle>
          <DialogDescription>
            Marca o formulário como pendente no lead. Operador preenche
            clicando no ícone do card (ou em &ldquo;Preencher&rdquo; no
            detalhe do lead). Não envia link via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="formId">Formulário</Label>
            <ResourceSelect
              queryOptions={orpc.form.list.queryOptions({ input: {} })}
              getItems={(d: any) => d?.forms ?? []}
              getId={(it: any) => it.id}
              getLabel={(it: any) => it.name ?? it.title ?? it.id}
              value={formId}
              onValueChange={setFormId}
              placeholder="Selecione um formulário"
              emptyMessage="Nenhum formulário publicado encontrado."
            />
            <p className="text-[10px] text-muted-foreground">
              O formulário aparecerá pendente no card do lead (ícone laranja)
              e na seção &ldquo;Formulários&rdquo; do detalhe do lead.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              onSubmit({
                formId: formId.trim(),
              })
            }
            disabled={!canSubmit}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
