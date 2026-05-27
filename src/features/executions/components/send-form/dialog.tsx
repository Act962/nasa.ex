"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { SendAppActionBaseDialog } from "../send-app-actions/base-dialog";
import { ResourceSelect } from "../send-app-actions/resource-select";
import { orpc } from "@/lib/orpc";
import type { SendFormData } from "./executor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: SendFormData;
  onSubmit: (values: SendFormData) => void;
}

const DEFAULT_MSG =
  "Olá {{nome}}! Por favor preencha este formulário ({{form_nome}}): {{url}}";

export function SendFormDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: Props) {
  const [formId, setFormId] = useState(defaultValues?.formId ?? "");
  const [messageTemplate, setMessageTemplate] = useState(
    defaultValues?.messageTemplate ?? "",
  );

  useEffect(() => {
    if (open) {
      setFormId(defaultValues?.formId ?? "");
      setMessageTemplate(defaultValues?.messageTemplate ?? "");
    }
  }, [open, defaultValues]);

  return (
    <SendAppActionBaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enviar Formulário"
      description="Cria uma resposta vinculada ao lead e envia o link via WhatsApp."
      messageTemplate={messageTemplate}
      onMessageTemplateChange={setMessageTemplate}
      defaultMessagePreview={DEFAULT_MSG}
      extraVariables={["{{form_nome}}", "{{form_descricao}}"]}
      canSubmit={formId.trim().length > 0}
      onSubmit={() =>
        onSubmit({
          formId: formId.trim(),
          messageTemplate: messageTemplate.trim() || undefined,
        })
      }
    >
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
      </div>
    </SendAppActionBaseDialog>
  );
}
