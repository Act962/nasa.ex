"use client";

import { Node, NodeProps } from "@xyflow/react";
import { ClipboardPenIcon } from "lucide-react";
import { BaseSendAppActionNode } from "../send-app-actions/base-node";
import { OpenFormDialog } from "./dialog";
import type { OpenFormData } from "./executor";

type OpenFormNodeType = Node<OpenFormData>;

export function OpenFormNode(props: NodeProps<OpenFormNodeType>) {
  return (
    <BaseSendAppActionNode<OpenFormData>
      nodeProps={props}
      icon={ClipboardPenIcon}
      name="Abrir Formulário"
      description={
        props.data?.formId
          ? `Formulário: ${props.data.formId.slice(0, 8)}…`
          : "Operador preenche em nome do lead (sem WhatsApp)"
      }
      renderDialog={({ open, onOpenChange, defaultValues, onSubmit }) => (
        <OpenFormDialog
          open={open}
          onOpenChange={onOpenChange}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
        />
      )}
    />
  );
}
