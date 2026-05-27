"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { SendAppActionBaseDialog } from "../send-app-actions/base-dialog";
import { ResourceSelect } from "../send-app-actions/resource-select";
import { orpc } from "@/lib/orpc";
import type { SendAgendaData } from "./executor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: SendAgendaData;
  onSubmit: (values: SendAgendaData) => void;
}

const DEFAULT_MSG =
  "Olá {{nome}}! Agende um horário com a gente em {{url}} ({{agenda_duracao}}).";

export function SendAgendaDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: Props) {
  const [agendaId, setAgendaId] = useState(defaultValues?.agendaId ?? "");
  const [messageTemplate, setMessageTemplate] = useState(
    defaultValues?.messageTemplate ?? "",
  );

  useEffect(() => {
    if (open) {
      setAgendaId(defaultValues?.agendaId ?? "");
      setMessageTemplate(defaultValues?.messageTemplate ?? "");
    }
  }, [open, defaultValues]);

  return (
    <SendAppActionBaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enviar Link de Agenda"
      description="Envia URL pública pro lead agendar um horário com a equipe."
      messageTemplate={messageTemplate}
      onMessageTemplateChange={setMessageTemplate}
      defaultMessagePreview={DEFAULT_MSG}
      extraVariables={["{{agenda_nome}}", "{{agenda_duracao}}"]}
      canSubmit={agendaId.trim().length > 0}
      onSubmit={() =>
        onSubmit({
          agendaId: agendaId.trim(),
          messageTemplate: messageTemplate.trim() || undefined,
        })
      }
    >
      <div className="space-y-2">
        <Label htmlFor="agendaId">Agenda</Label>
        <ResourceSelect
          queryOptions={orpc.agenda.getMany.queryOptions({ input: {} })}
          getItems={(d: any) => d?.agendas ?? []}
          getId={(it: any) => it.id}
          getLabel={(it: any) => it.name ?? it.slug ?? it.id}
          value={agendaId}
          onValueChange={setAgendaId}
          placeholder="Selecione uma agenda"
          emptyMessage="Nenhuma agenda encontrada."
        />
      </div>
    </SendAppActionBaseDialog>
  );
}
