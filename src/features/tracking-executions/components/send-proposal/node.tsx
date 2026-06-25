"use client";

import { Node, NodeProps } from "@xyflow/react";
import { FileSignatureIcon } from "lucide-react";
import { BaseSendAppActionNode } from "../send-app-actions/base-node";
import { SendProposalDialog } from "./dialog";
import type { SendProposalData } from "./executor";

type SendProposalNodeType = Node<SendProposalData>;

export function SendProposalNode(props: NodeProps<SendProposalNodeType>) {
  return (
    <BaseSendAppActionNode<SendProposalData>
      nodeProps={props}
      icon={FileSignatureIcon}
      name="Enviar Proposta"
      description={
        props.data?.productIds?.length
          ? `${props.data.productIds.length} produto(s)`
          : "Cria proposta + envia link"
      }
      renderDialog={({ open, onOpenChange, defaultValues, onSubmit }) => (
        <SendProposalDialog
          open={open}
          onOpenChange={onOpenChange}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
        />
      )}
    />
  );
}
