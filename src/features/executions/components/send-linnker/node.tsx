"use client";

import { Node, NodeProps } from "@xyflow/react";
import { Link2Icon } from "lucide-react";
import { BaseSendAppActionNode } from "../send-app-actions/base-node";
import { SendLinnkerDialog } from "./dialog";
import type { SendLinnkerData } from "./executor";

type SendLinnkerNodeType = Node<SendLinnkerData>;

export function SendLinnkerNode(props: NodeProps<SendLinnkerNodeType>) {
  return (
    <BaseSendAppActionNode<SendLinnkerData>
      nodeProps={props}
      icon={Link2Icon}
      name="Enviar Linnker"
      description={
        props.data?.linnkerPageId
          ? `Page: ${props.data.linnkerPageId.slice(0, 8)}…`
          : "Envia link de página Linnker"
      }
      renderDialog={({ open, onOpenChange, defaultValues, onSubmit }) => (
        <SendLinnkerDialog
          open={open}
          onOpenChange={onOpenChange}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
        />
      )}
    />
  );
}
