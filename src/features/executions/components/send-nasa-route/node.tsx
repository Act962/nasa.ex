"use client";

import { Node, NodeProps } from "@xyflow/react";
import { GraduationCapIcon } from "lucide-react";
import { BaseSendAppActionNode } from "../send-app-actions/base-node";
import { SendNasaRouteDialog } from "./dialog";
import type { SendNasaRouteData } from "./executor";

type SendNasaRouteNodeType = Node<SendNasaRouteData>;

export function SendNasaRouteNode(props: NodeProps<SendNasaRouteNodeType>) {
  return (
    <BaseSendAppActionNode<SendNasaRouteData>
      nodeProps={props}
      icon={GraduationCapIcon}
      name="Enviar Curso NASA Route"
      description={
        props.data?.courseId
          ? `Curso: ${props.data.courseId.slice(0, 8)}…`
          : "Envia link de curso (matrícula/checkout)"
      }
      renderDialog={({ open, onOpenChange, defaultValues, onSubmit }) => (
        <SendNasaRouteDialog
          open={open}
          onOpenChange={onOpenChange}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
        />
      )}
    />
  );
}
