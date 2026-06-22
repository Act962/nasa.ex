"use client";

import { Node, NodeProps } from "@xyflow/react";
import { ClipboardListIcon } from "lucide-react";
import { BaseSendAppActionNode } from "../send-app-actions/base-node";
import { SendFormDialog } from "./dialog";
import type { SendFormData } from "./executor";

type SendFormNodeType = Node<SendFormData>;

export function SendFormNode(props: NodeProps<SendFormNodeType>) {
  return (
    <BaseSendAppActionNode<SendFormData>
      nodeProps={props}
      icon={ClipboardListIcon}
      name="Enviar Formulário"
      description={
        props.data?.formId
          ? `Formulário: ${props.data.formId.slice(0, 8)}…`
          : "Envia link de formulário pro lead"
      }
      renderDialog={({ open, onOpenChange, defaultValues, onSubmit }) => (
        <SendFormDialog
          open={open}
          onOpenChange={onOpenChange}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
        />
      )}
    />
  );
}
