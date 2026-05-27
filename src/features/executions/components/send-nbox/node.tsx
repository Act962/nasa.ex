"use client";

import { Node, NodeProps } from "@xyflow/react";
import { FolderOpenIcon } from "lucide-react";
import { BaseSendAppActionNode } from "../send-app-actions/base-node";
import { SendNboxDialog } from "./dialog";
import type { SendNboxData } from "./executor";

type SendNboxNodeType = Node<SendNboxData>;

export function SendNboxNode(props: NodeProps<SendNboxNodeType>) {
  return (
    <BaseSendAppActionNode<SendNboxData>
      nodeProps={props}
      icon={FolderOpenIcon}
      name="Enviar Arquivo N-Box"
      description={
        props.data?.nboxItemId
          ? `Arquivo: ${props.data.nboxItemId.slice(0, 8)}…`
          : "Envia link de arquivo do N-Box"
      }
      renderDialog={({ open, onOpenChange, defaultValues, onSubmit }) => (
        <SendNboxDialog
          open={open}
          onOpenChange={onOpenChange}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
        />
      )}
    />
  );
}
