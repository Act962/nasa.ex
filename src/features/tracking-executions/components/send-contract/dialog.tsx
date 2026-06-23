"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { SendAppActionBaseDialog } from "../send-app-actions/base-dialog";
import { ResourceSelect } from "../send-app-actions/resource-select";
import { orpc } from "@/lib/orpc";
import type { SendContractData } from "./executor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: SendContractData;
  onSubmit: (values: SendContractData) => void;
}

const DEFAULT_MSG =
  "Olá {{nome}}, segue o contrato nº {{contrato_numero}} pra sua assinatura: {{url}}";

export function SendContractDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: Props) {
  const [templateContractId, setTemplateContractId] = useState(
    defaultValues?.templateContractId ?? "",
  );
  const [messageTemplate, setMessageTemplate] = useState(
    defaultValues?.messageTemplate ?? "",
  );

  useEffect(() => {
    if (open) {
      setTemplateContractId(defaultValues?.templateContractId ?? "");
      setMessageTemplate(defaultValues?.messageTemplate ?? "");
    }
  }, [open, defaultValues]);

  return (
    <SendAppActionBaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enviar Contrato"
      description="Clona um template de contrato com o lead como signer e envia link de assinatura."
      messageTemplate={messageTemplate}
      onMessageTemplateChange={setMessageTemplate}
      defaultMessagePreview={DEFAULT_MSG}
      extraVariables={[
        "{{contrato_nome}}",
        "{{contrato_numero}}",
        "{{valor}}",
      ]}
      canSubmit={templateContractId.trim().length > 0}
      onSubmit={() =>
        onSubmit({
          templateContractId: templateContractId.trim(),
          messageTemplate: messageTemplate.trim() || undefined,
        })
      }
    >
      <div className="space-y-2">
        <Label htmlFor="templateContractId">Template de Contrato</Label>
        <ResourceSelect
          queryOptions={orpc.forge.templates.list.queryOptions({ input: {} })}
          getItems={(d: any) => d?.templates ?? []}
          getId={(it: any) => it.id}
          getLabel={(it: any) => it.name ?? it.id}
          value={templateContractId}
          onValueChange={setTemplateContractId}
          placeholder="Selecione um template"
          emptyMessage="Nenhum template encontrado."
        />
      </div>
    </SendAppActionBaseDialog>
  );
}
