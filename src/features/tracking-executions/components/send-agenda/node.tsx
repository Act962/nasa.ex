"use client";

import { Node, NodeProps } from "@xyflow/react";
import { CalendarIcon } from "lucide-react";
import { BaseSendAppActionNode } from "../send-app-actions/base-node";
import { SendAgendaDialog } from "./dialog";
import type { SendAgendaData } from "./executor";

type SendAgendaNodeType = Node<SendAgendaData>;

export function SendAgendaNode(props: NodeProps<SendAgendaNodeType>) {
  return (
    <BaseSendAppActionNode<SendAgendaData>
      nodeProps={props}
      icon={CalendarIcon}
      name="Enviar Link de Agenda"
      description={
        props.data?.agendaId
          ? `Agenda: ${props.data.agendaId.slice(0, 8)}…`
          : "Envia link público de agendamento"
      }
      renderDialog={({ open, onOpenChange, defaultValues, onSubmit }) => (
        <SendAgendaDialog
          open={open}
          onOpenChange={onOpenChange}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
        />
      )}
    />
  );
}
