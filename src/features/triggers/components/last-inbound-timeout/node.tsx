"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { ClockAlertIcon } from "lucide-react";
import {
  LastInboundTimeoutTriggerDialog,
  type LastInboundTimeoutTriggerData,
} from "./dialog";

type NodeData = Partial<LastInboundTimeoutTriggerData> & {
  minutes?: number;
};

type NodeShape = Node<NodeData>;

export const LastInboundTimeoutTriggerNode = memo(
  (props: NodeProps<NodeShape>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const handleSave = (values: LastInboundTimeoutTriggerData) => {
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === props.id ? { ...n, data: { ...n.data, ...values } } : n,
        ),
      );
    };

    const minutes = props.data?.minutes ?? 30;

    return (
      <>
        <LastInboundTimeoutTriggerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          data={{ minutes }}
          onSave={handleSave}
        />
        <BaseTriggerNode
          {...props}
          icon={ClockAlertIcon}
          name="Última Interação do Lead"
          description={`Dispara se passarem ${minutes} min sem resposta`}
          status="initial"
          onSettings={() => setDialogOpen(true)}
          onDoubleClick={() => setDialogOpen(true)}
        />
      </>
    );
  },
);

LastInboundTimeoutTriggerNode.displayName = "LastInboundTimeoutTriggerNode";
