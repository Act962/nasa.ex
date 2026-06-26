"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { SunriseIcon } from "lucide-react";
import {
  FirstInteractionOfDayDialog,
  FirstInteractionOfDayFormValues,
} from "./dialog";

type FirstInteractionOfDayNodeData = {
  action?: FirstInteractionOfDayFormValues;
};

type FirstInteractionOfDayNodeType = Node<FirstInteractionOfDayNodeData>;

const pad = (value: number) => String(value).padStart(2, "0");

export const FirstInteractionOfDayTriggerNode = memo(
  (props: NodeProps<FirstInteractionOfDayNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: FirstInteractionOfDayFormValues) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === props.id
            ? { ...node, data: { ...node.data, action: values } }
            : node,
        ),
      );
    };

    const config = props.data?.action;
    const startHour = config?.startHour ?? 8;
    const startMinute = config?.startMinute ?? 0;
    const description = `Quando o lead volta a falar após as ${pad(startHour)}:${pad(startMinute)}`;

    return (
      <>
        <FirstInteractionOfDayDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          defaultValues={config}
        />
        <BaseTriggerNode
          {...props}
          icon={SunriseIcon}
          name="Primeira Interação do Dia"
          description={description}
          status="initial"
          onSettings={handleOpenSettings}
          onDoubleClick={handleOpenSettings}
        />
      </>
    );
  },
);

FirstInteractionOfDayTriggerNode.displayName = "FirstInteractionOfDayTriggerNode";
