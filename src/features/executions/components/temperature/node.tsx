"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { CircleGaugeIcon } from "lucide-react";
import { TemperatureDialog, TemperatureFormValues } from "./dialog";
import { useNodeStatus } from "../../hook/use-node-status";
import { TEMPERATURE_CHANNEL_NAME } from "@/inngest/channels/temperature";
import { fetchTemperatureRealtimeToken } from "./actions";

type TemperatureNodeData = {
  action?: TemperatureFormValues;
};

type TemperatureNodeType = Node<TemperatureNodeData>;

export const TemperatureNode = memo((props: NodeProps<TemperatureNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: TEMPERATURE_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchTemperatureRealtimeToken,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: TemperatureFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              action: values,
            },
          };
        }

        return node;
      }),
    );
  };

  const nodeData = props.data;
  // const description = nodeData?.endpoint
  //   ? `${nodeData.method || "GET"}: ${nodeData.endpoint}`
  //   : "Not configured";

  return (
    <>
      <TemperatureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData.action}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={CircleGaugeIcon}
        name="Temperatura"
        status={nodeStatus}
        description="Altera a temperatura do lead"
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

TemperatureNode.displayName = "TemperatureNode";
