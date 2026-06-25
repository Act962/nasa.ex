"use client";

import { Node, NodeProps } from "@xyflow/react";
import { FileTextIcon } from "lucide-react";
import { BaseSendAppActionNode } from "../send-app-actions/base-node";
import { SendContractDialog } from "./dialog";
import type { SendContractData } from "./executor";

type SendContractNodeType = Node<SendContractData>;

export function SendContractNode(props: NodeProps<SendContractNodeType>) {
  return (
    <BaseSendAppActionNode<SendContractData>
      nodeProps={props}
      icon={FileTextIcon}
      name="Enviar Contrato"
      description={
        props.data?.templateContractId
          ? `Template: ${props.data.templateContractId.slice(0, 8)}…`
          : "Cria contrato + envia link de assinatura"
      }
      renderDialog={({ open, onOpenChange, defaultValues, onSubmit }) => (
        <SendContractDialog
          open={open}
          onOpenChange={onOpenChange}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
        />
      )}
    />
  );
}
