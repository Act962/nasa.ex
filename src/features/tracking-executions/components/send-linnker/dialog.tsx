"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { SendAppActionBaseDialog } from "../send-app-actions/base-dialog";
import { ResourceSelect } from "../send-app-actions/resource-select";
import { orpc } from "@/lib/orpc";
import type { SendLinnkerData } from "./executor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: SendLinnkerData;
  onSubmit: (values: SendLinnkerData) => void;
}

const DEFAULT_MSG =
  "Olá {{nome}}, aqui estão nossos links principais ({{linnker_nome}}): {{url}}";

export function SendLinnkerDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: Props) {
  const [linnkerPageId, setLinnkerPageId] = useState(
    defaultValues?.linnkerPageId ?? "",
  );
  const [messageTemplate, setMessageTemplate] = useState(
    defaultValues?.messageTemplate ?? "",
  );

  useEffect(() => {
    if (open) {
      setLinnkerPageId(defaultValues?.linnkerPageId ?? "");
      setMessageTemplate(defaultValues?.messageTemplate ?? "");
    }
  }, [open, defaultValues]);

  return (
    <SendAppActionBaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enviar Linnker"
      description="Envia link público de página Linnker pro lead via WhatsApp."
      messageTemplate={messageTemplate}
      onMessageTemplateChange={setMessageTemplate}
      defaultMessagePreview={DEFAULT_MSG}
      extraVariables={["{{linnker_nome}}"]}
      canSubmit={linnkerPageId.trim().length > 0}
      onSubmit={() =>
        onSubmit({
          linnkerPageId: linnkerPageId.trim(),
          messageTemplate: messageTemplate.trim() || undefined,
        })
      }
    >
      <div className="space-y-2">
        <Label htmlFor="linnkerPageId">Página Linnker</Label>
        <ResourceSelect
          queryOptions={orpc.linnker.listPages.queryOptions({ input: {} })}
          getItems={(d: any) => d?.pages ?? []}
          getId={(it: any) => it.id}
          getLabel={(it: any) =>
            `${it.title ?? it.slug}${it.isPublished ? "" : " (rascunho)"}`
          }
          value={linnkerPageId}
          onValueChange={setLinnkerPageId}
          placeholder="Selecione uma página Linnker"
          emptyMessage="Nenhuma página Linnker encontrada."
        />
      </div>
    </SendAppActionBaseDialog>
  );
}
